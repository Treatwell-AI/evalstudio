---
sidebar_position: 2
---

# Projects

EvalStudio supports multiple projects within a single workspace. Each project has isolated data and optional configuration overrides.

## Workspace Structure

```
my-evals/
  evalstudio.config.json          # Workspace config + project registry + defaults + per-project overrides
  projects/
    <uuid>/
      data/                       # Entity data (personas, scenarios, etc.)
```

## Configuration Hierarchy

All configuration lives in `evalstudio.config.json`. Workspace defaults are merged with per-project overrides stored in the `projects[]` array:

- **Workspace-level fields** (`llmSettings`, `maxConcurrency`) — shared defaults
- **Per-project entries** (`projects[].llmSettings`, `projects[].maxConcurrency`) — project-specific overrides; unset fields inherit from workspace

## Import

```typescript
import {
  // Workspace operations
  resolveWorkspace,
  initWorkspace,
  readWorkspaceConfig,
  updateWorkspaceConfig,
  // Project operations
  listProjects,
  createProject,
  resolveProject,
  resolveProjectFromCwd,
  deleteProject,
  // Project config
  getProjectConfig,
  updateProjectConfig,
  // Types
  type ProjectContext,
  type ProjectConfig,
  type WorkspaceConfig,
  type LLMSettings,
} from "@evalstudio/core";
```

## Types

### ProjectContext

Immutable context for a specific project, passed to all entity functions.

```typescript
interface ProjectContext {
  id: string;           // UUID
  name: string;         // Display name
  dataDir: string;      // Absolute path to projects/{uuid}/data/
  workspaceDir: string; // Absolute path to workspace root
}
```

### ProjectConfig

Effective project configuration (workspace defaults merged with project overrides).

```typescript
interface ProjectConfig {
  version: number;
  name: string;
  llmSettings?: LLMSettings;
  maxConcurrency?: number;
}
```

### WorkspaceConfig

```typescript
interface ProjectEntry {
  id: string;
  name: string;
  llmSettings?: LLMSettings;
  maxConcurrency?: number;
}

interface WorkspaceConfig extends ProjectConfig {
  projects: ProjectEntry[];
}
```

### LLMSettings

```typescript
interface LLMSettings {
  provider: ProviderType;     // "openai" or "anthropic"
  apiKey: string;
  models?: LLMModelSettings;
}

interface LLMModelSettings {
  evaluation?: string;  // Model for evaluation/judging
  persona?: string;     // Model for persona generation
}
```

## Functions

### resolveProjectFromCwd()

Resolve a ProjectContext from the current working directory.

```typescript
function resolveProjectFromCwd(startDir?: string): ProjectContext;
```

Resolution order:
1. If inside `projects/{uuid}/` (registered in workspace config), use that project
2. If at workspace root with exactly one project, use it
3. Otherwise, throw

### createProject()

Create a new project in a workspace.

```typescript
function createProject(workspaceDir: string, name: string): ProjectContext;
```

### resolveProject()

Resolve a project by ID (supports prefix matching).

```typescript
function resolveProject(workspaceDir: string, projectId: string): ProjectContext;
```

### getProjectConfig()

Get the effective (merged) configuration for a project.

```typescript
function getProjectConfig(ctx: ProjectContext): ProjectConfig;
```

### updateProjectConfig()

Update a project's configuration.

```typescript
function updateProjectConfig(
  ctx: ProjectContext,
  input: UpdateProjectConfigInput,
): ProjectConfig;
```

### initWorkspace()

Initialize a new workspace with its first project.

```typescript
function initWorkspace(
  dir: string,
  workspaceName: string,
  projectName: string,
): InitWorkspaceResult;
```

## Entity Functions

All entity modules (persona, scenario, eval, connector, run, execution) accept a `ProjectContext` parameter:

```typescript
import { listPersonas, createPersona, type ProjectContext } from "@evalstudio/core";

const ctx: ProjectContext = resolveProjectFromCwd();
const personas = listPersonas(ctx);
const persona = createPersona(ctx, { name: "frustrated-customer" });
```
