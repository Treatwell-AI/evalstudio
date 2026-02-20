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
  // Storage
  createStorageProvider,
  resolveConnectionString,
  // Project config
  getProjectConfig,
  updateProjectConfig,
  // Types
  type StorageProvider,
  type StorageType,
  type StorageConfig,
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
  storage?: StorageConfig;
  projects: ProjectEntry[];
}
```

### StorageConfig

```typescript
type StorageType = "filesystem" | "postgres";

interface FilesystemStorageConfig {
  type: "filesystem";
}

interface PostgresStorageConfig {
  type: "postgres";
  connectionString: string;  // Supports ${VAR} placeholders
}

type StorageConfig = FilesystemStorageConfig | PostgresStorageConfig;
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

### createStorageProvider()

Create the appropriate storage backend based on workspace config.

```typescript
async function createStorageProvider(workspaceDir: string): Promise<StorageProvider>;
```

Returns a `FilesystemStorageProvider` by default. When `storage.type` is `"postgres"` in the workspace config, dynamically imports `@evalstudio/postgres` and returns a `PostgresStorageProvider`.

### getProjectConfig()

Get the effective (merged) configuration for a project.

```typescript
async function getProjectConfig(
  storage: StorageProvider,
  workspaceDir: string,
  projectId: string,
): Promise<ProjectConfig>;
```

### updateProjectConfig()

Update a project's configuration.

```typescript
async function updateProjectConfig(
  storage: StorageProvider,
  workspaceDir: string,
  projectId: string,
  input: UpdateProjectConfigInput,
): Promise<ProjectConfig>;
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

All entity modules use `createProjectModules()` which accepts a `StorageProvider` and project ID:

```typescript
import { createStorageProvider, createProjectModules, resolveWorkspace } from "@evalstudio/core";

const workspaceDir = resolveWorkspace();
const storage = await createStorageProvider(workspaceDir);
const modules = createProjectModules(storage, projectId);

const personas = await modules.personas.list();
const persona = await modules.personas.create({ name: "frustrated-customer" });
```

## Storage Configuration

By default, EvalStudio stores data as JSON files in `projects/{uuid}/data/`. To use PostgreSQL, add a `storage` field to `evalstudio.config.json`:

```json
{
  "storage": {
    "type": "postgres",
    "connectionString": "postgresql://user:pass@localhost:5432/evalstudio"
  }
}
```

The connection string supports `${VAR}` placeholders for environment variable substitution:

```json
{
  "storage": {
    "type": "postgres",
    "connectionString": "postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:5432/evalstudio"
  }
}
```

If `connectionString` is not set in the config, `EVALSTUDIO_DATABASE_URL` environment variable is used as a fallback.

Before using PostgreSQL storage, initialize the schema:

```bash
evalstudio db init
```
