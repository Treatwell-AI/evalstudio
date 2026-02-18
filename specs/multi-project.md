# Multi-Project Mode

**Status:** Proposal
**Date:** 2026-02-18

---

## Problem

Currently, one directory = one project. To test multiple products or agents, you need separate directories with separate `evalstudio serve` instances. This makes it hard to share LLM credentials and workspace-level settings across related projects.

## Proposal

A single EvalStudio workspace hosts multiple projects. Each project represents a distinct product or agent being tested. The root `evalstudio.config.json` holds workspace-level defaults (LLM credentials, concurrency), and each project has a `project.config.json` that can override what it needs.

---

## Folder Structure

Every project lives under `projects/{uuid}/`. There is no `data/` at the root level — even a single-project setup uses this structure.

```
my-evals/
  evalstudio.config.json                   # Workspace config (defaults + project registry)
  projects/
    a1b2c3d4-e5f6-7890-abcd-ef1234567890/
      project.config.json                  # Per-project overrides
      data/                                # Per-project entity data
    f9e8d7c6-b5a4-3210-fedc-ba9876543210/
      project.config.json                  # Per-project overrides
      data/                                # Per-project entity data
```

### `evalstudio init`

On `evalstudio init`, the CLI:

1. Creates `evalstudio.config.json` (version 3) with the workspace name
2. Generates a UUID for the first project
3. Creates `projects/{uuid}/project.config.json` with the project name
4. Creates `projects/{uuid}/data/`

Result:

```
my-evals/
  evalstudio.config.json                   # { version: 3, name: "my-evals", projects: [{ id: "a1b2...", name: "My Product" }], llmSettings: ... }
  projects/
    a1b2c3d4-e5f6-7890-abcd-ef1234567890/
      project.config.json                  # { name: "My Product" }
      data/
```

Single-project and multi-project are the **same structure** — the only difference is how many entries are in `projects/`.

---

## Configuration

### Workspace config (root)

The root config acts as a registry of projects and provides defaults.

```json
{
  "version": 3,
  "name": "My Workspace",
  "projects": [
    { "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890", "name": "Booking Chatbot" },
    { "id": "f9e8d7c6-b5a4-3210-fedc-ba9876543210", "name": "Support Agent" }
  ],
  "llmSettings": {
    "provider": "openai",
    "apiKey": "sk-...",
    "models": {
      "evaluation": "gpt-4o",
      "persona": "gpt-4o-mini"
    }
  },
  "maxConcurrency": 5
}
```

The `projects` array is the source of truth for which projects exist. Each entry has:

- `id` — UUID, matches the folder name under `projects/`
- `name` — display name (also stored in per-project config for convenience)

### Per-project config

```json
{
  "name": "Booking Chatbot",
  "llmSettings": {
    "provider": "anthropic",
    "apiKey": "sk-ant-..."
  }
}
```

Per-project configs (`project.config.json`) are **sparse** — they only contain fields that differ from the workspace. Fields not present are inherited from the root config. This means:

- A project that only needs a different connector doesn't need to repeat the LLM settings
- A project that needs a different provider overrides only `llmSettings`
- `maxConcurrency` can be set per-project or inherited from root

### Config resolution

For any project, the effective config is:

```
effectiveConfig = shallowMerge(workspaceConfig, projectConfig)
```

Rules:

- Scalar fields (string, number, boolean): project value wins if present
- `null` explicitly clears a field (removes workspace default)
- Objects (`llmSettings`): project replaces the entire object if present — no partial merge of nested fields
- `version`, `projects` are workspace-only fields, ignored in per-project configs

---

## Data Isolation

Each project has its own `data/` directory. Entities (personas, scenarios, evals, connectors, runs, executions) are **fully isolated** per project — no cross-project references.

This means:

- A persona in project A cannot be referenced by an eval in project B
- Runs in project A are only visible in project A
- Each project has independent connector configurations

### Shared entities (future consideration)

Sharing entities across projects (e.g., reusing personas) is **out of scope** for this proposal. If needed later, it can be addressed via:

- Import/export between projects (JSONL already supported for scenarios)
- Symlinks at the filesystem level

---

## Core Changes

### No global state — explicit `ProjectContext` everywhere

The current codebase uses global state (`getStorageDir()`, `getConfigPath()`) that entity modules call implicitly. This works for single-project because there's only one answer. With multiple projects, global state breaks under concurrency (two API requests for different projects at the same time).

Instead, introduce a **`ProjectContext`** value object that gets created once per request/command and threaded explicitly through all core functions.

### project-resolver.ts

```typescript
/**
 * Immutable context for a specific project.
 * Created once per CLI command or API request, passed explicitly.
 */
interface ProjectContext {
  id: string; // UUID
  name: string; // Display name
  dataDir: string; // Absolute path to projects/{uuid}/data/
  configPath: string; // Absolute path to projects/{uuid}/project.config.json
  workspaceDir: string; // Absolute path to workspace root
}

// Resolve context from cwd (CLI: user is cd'd into a project dir)
function resolveProjectFromCwd(): ProjectContext;

// Resolve context from an explicit project ID (API: from URL param)
function resolveProject(
  workspaceDir: string,
  projectId: string,
): ProjectContext;

// Workspace-level operations (no project context needed)
function resolveWorkspace(startDir?: string): string; // find workspace root
function listProjects(workspaceDir: string): ProjectInfo[];
function createProject(workspaceDir: string, name: string): ProjectContext;
function deleteProject(workspaceDir: string, projectId: string): void;
```

There is **no mutable state** — `resolveProjectFromCwd()` reads the filesystem and returns an immutable object. `resolveProject()` does the same from an explicit ID. Both are pure lookups.

### project.ts

All config functions take a `ProjectContext`:

```typescript
function getProjectConfig(ctx: ProjectContext): ProjectConfig;
function updateProjectConfig(
  ctx: ProjectContext,
  input: UpdateProjectConfigInput,
): ProjectConfig;
```

`getProjectConfig()` reads the per-project config and merges with workspace defaults. `updateProjectConfig()` writes only to the per-project config file.

```typescript
interface WorkspaceConfig extends ProjectConfig {
  projects: Array<{ id: string; name: string }>;
}

function readWorkspaceConfig(workspaceDir: string): WorkspaceConfig;
function updateWorkspaceConfig(workspaceDir: string, input: ...): WorkspaceConfig;
```

### repository.ts

The repository factory takes an explicit `dataDir` instead of calling the global `getStorageDir()`:

```typescript
// Before (v2) — implicit global state
const repo = createJsonRepository<Persona>("personas.json");

// After (v3) — explicit data directory
const repo = createJsonRepository<Persona>("personas.json", dataDir);
```

```typescript
function createJsonRepository<T>(
  filename: string,
  dataDir: string,
): Repository<T> {
  return {
    findAll(): T[] {
      const path = join(dataDir, filename);
      if (!existsSync(path)) return [];
      return JSON.parse(readFileSync(path, "utf-8")) as T[];
    },
    saveAll(items: T[]): void {
      writeFileSync(join(dataDir, filename), JSON.stringify(items, null, 2));
    },
  };
}
```

### Entity modules (persona.ts, scenario.ts, etc.)

Entity modules can no longer create a module-level `const repo = ...` since the `dataDir` isn't known at import time. Instead, each module exports a factory that creates a scoped instance bound to a `ProjectContext`:

```typescript
export function createPersonaModule(ctx: ProjectContext) {
  const repo = createJsonRepository<Persona>("personas.json", ctx.dataDir);
  return {
    create(input: CreatePersonaInput): Persona {
      /* ... */
    },
    get(id: string): Persona {
      /* ... */
    },
    list(): Persona[] {
      /* ... */
    },
    // ...
  };
}
```

The caller creates the module once with the context, then calls methods without repeating `ctx`. The module has access to the full `ProjectContext` if it needs config or workspace info later:

```typescript
// In API route handler
const ctx = resolveProject(workspaceDir, request.params.projectId);
const personas = createPersonaModule(ctx);
const list = personas.list();

// In CLI command
const ctx = resolveProjectFromCwd();
const evals = createEvalModule(ctx);
```

### How each interface creates the context

**CLI** (from working directory):

```typescript
// User ran `evalstudio use <id>` and is now inside projects/{uuid}/
const ctx = resolveProjectFromCwd();
const personas = createPersonaModule(ctx);
personas.list();
```

**API** (from URL param):

```typescript
// Route: GET /api/projects/:projectId/personas
const ctx = resolveProject(workspaceDir, request.params.projectId);
const personas = createPersonaModule(ctx);
return personas.list();
```

No global state, no ambient context, fully concurrent-safe.

---

## CLI Changes

### Project selection via `evalstudio use`

Instead of a `--project` flag on every command, the user switches into a project directory. Since each project has its own `project.config.json`, the existing directory-based config discovery works naturally — all commands automatically operate on the project you're in.

```bash
# Switch into a project (cd into projects/{uuid}/)
evalstudio use a1b2c3d4
# → Changes directory to <workspace>/projects/a1b2c3d4-e5f6-7890-abcd-ef1234567890/

# Now all commands operate on that project — no flags needed
evalstudio status
evalstudio eval list
evalstudio run create --eval eval-1

# Go back to workspace root
cd ..
```

`evalstudio use` accepts a UUID prefix (first 8 chars are enough if unambiguous) or project name:

```bash
evalstudio use a1b2c3d4          # UUID prefix
evalstudio use "Booking Chatbot"  # project name
```

**Note**: `evalstudio use` needs to change the shell's working directory, not just the subprocess. This requires a shell function or alias (similar to `nvm use`). The CLI outputs the `cd` command and the shell integration executes it:

```bash
# Shell integration (added to .bashrc/.zshrc)
evalstudio() {
  if [ "$1" = "use" ]; then
    local dir=$(command evalstudio _resolve-project "$2")
    [ -n "$dir" ] && cd "$dir"
  else
    command evalstudio "$@"
  fi
}
```

Alternatively, without shell integration, the user can just `cd` manually:

```bash
# List projects to see paths
evalstudio projects list
# → a1b2c3d4  Booking Chatbot   projects/a1b2c3d4-.../
# → f9e8d7c6  Support Agent     projects/f9e8d7c6-.../

cd projects/a1b2c3d4-e5f6-7890-abcd-ef1234567890
evalstudio status
```

### Project management

```bash
# List all projects in the workspace
evalstudio projects list

# Create a new project
evalstudio projects create --name "Support Agent"
# → Generates UUID, creates projects/{uuid}/, updates workspace config

# Delete a project (prompts for confirmation)
evalstudio projects delete a1b2c3d4

# Show project details
evalstudio projects show a1b2c3d4
```

---

## API Changes

### All entity routes scoped under `/api/projects/:projectId/`

The project context is part of the URL path — no headers or cookies needed. Every entity endpoint moves under the project prefix:

```
# Before (v2)
GET  /api/personas
POST /api/runs
GET  /api/evals/:evalId

# After (v3)
GET  /api/projects/:projectId/personas
POST /api/projects/:projectId/runs
GET  /api/projects/:projectId/evals/:evalId
```

This makes the project context explicit, bookmarkable, and easy to debug. The API server resolves which `projects/{uuid}/data/` directory to use from the URL path.

### Project management endpoints (workspace-level)

```
GET    /api/projects                    # List all projects
POST   /api/projects                    # Create a new project
GET    /api/projects/:projectId         # Get project config (effective)
PUT    /api/projects/:projectId         # Update per-project config
DELETE /api/projects/:projectId         # Delete project
```

### Workspace-level endpoints (no project scope)

These operate at the workspace level and remain at the root:

```
GET  /api/status                        # Server status
GET  /api/llm-providers/models          # Default model list (from core, not project-specific)
```

### Full route structure

```
/api/
  status
  llm-providers/models
  llm-providers/:providerType/models
  projects/                             # List / create
  projects/:projectId/                  # Get / update / delete project config
  projects/:projectId/personas          # All persona CRUD
  projects/:projectId/scenarios         # All scenario CRUD
  projects/:projectId/evals             # All eval CRUD
  projects/:projectId/connectors        # All connector CRUD
  projects/:projectId/runs              # All run CRUD
  projects/:projectId/config            # Per-project config (project.config.json)
```

### Implementation

The API server resolves the `ProjectContext` from the URL param in a `preHandler` hook and attaches it to the request. Route handlers read it from the request — no global state.

```typescript
// Decorate request with project context
fastify.decorateRequest("projectCtx", null);

await fastify.register(
  async (scoped) => {
    scoped.addHook("preHandler", async (request) => {
      const { projectId } = request.params;
      request.projectCtx = resolveProject(workspaceDir, projectId);
    });

    await scoped.register(personasRoute);
    await scoped.register(scenariosRoute);
    await scoped.register(evalsRoute);
    // ...
  },
  { prefix: "/api/projects/:projectId" },
);
```

Route handlers use the context to create scoped entity modules:

```typescript
// routes/personas.ts
fastify.get("/personas", async (request) => {
  const personas = createPersonaModule(request.projectCtx);
  return personas.list();
});
```

---

## Web UI Changes

### Project switcher

- A project dropdown in the sidebar (below the workspace name)
- Shows all available projects (from `GET /api/projects`)
- Selected project is derived from the URL path (`:projectId` route param) — no localStorage needed
- All API calls use project-scoped URLs (`/api/projects/${projectId}/...`)
- Single-project workspaces: switcher is hidden, root `/` redirects to `/projects/:projectId/dashboard`

### Project management

- Settings page has a "Projects" section
- Create/rename/delete projects
- Per-project config editor showing which fields are inherited vs overridden

### URL routing

Web routes mirror the API structure with the project ID in the path:

```
/projects/:projectId/dashboard
/projects/:projectId/evals
/projects/:projectId/scenarios
/projects/:projectId/personas
/projects/:projectId/settings
```

The project switcher navigates between these URL trees. The API client reads the project ID from the current route and builds API URLs accordingly (`/api/projects/${projectId}/personas`, etc.).

---

## Run Processor

A single `RunProcessor` serves all projects:

- On each poll cycle, iterates over all projects' `data/` directories to find queued runs
- When a run is picked up, resolves the `ProjectContext` for that run's project
- Executes the run using the project's effective config (LLM settings, connector)
- `maxConcurrency` is a workspace-level setting (controls total in-flight runs across all projects)

---

## Scope

### In scope

- Folder structure with `projects/{uuid}/` subdirectories
- Separate config files: `evalstudio.config.json` (workspace) + `project.config.json` (per-project)
- Project registry in workspace config (`projects` array)
- Config inheritance (workspace → per-project shallow merge)
- Full data isolation per project (`projects/{uuid}/data/`)
- Explicit `ProjectContext` — no global mutable state
- Scoped entity module factories (`createPersonaModule(ctx)`, etc.)
- CLI `evalstudio use` command and `projects` subcommand
- API URL-scoped routes (`/api/projects/:projectId/...`)
- Web project switcher with URL-based project context
- Single project-aware `RunProcessor`

### Out of scope

- Shared entities across projects
- Cross-project comparisons or dashboards
- Project-level access control / permissions
- Project templates or cloning
