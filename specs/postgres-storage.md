# PostgreSQL Storage Backend

**Status:** Proposal
**Date:** 2026-02-18

---

## Problem

EvalStudio stores all data as JSON files on the local filesystem. This works well for single-user local workflows but breaks down for:

- **Team usage**: multiple users need shared access to the same evaluations and results
- **Production deployments**: file-based storage doesn't survive container restarts, can't scale horizontally
- **Large datasets**: loading entire JSON arrays into memory for every operation doesn't scale with thousands of runs
- **Concurrent writes**: simultaneous writes to the same JSON file cause data loss

## Proposal

Add PostgreSQL as an optional storage backend via a separate `@evalstudio/postgres` package. The storage type is configured in `evalstudio.config.json` — default remains `filesystem` (no breaking change). When Postgres is selected, all entity data is stored in database tables, and the project registry moves from the config file's `projects[]` array to a `projects` table.

---

## User Profiles

The two deployment modes map cleanly to two user profiles:

- **Local / quick usage**: `npx @evalstudio/cli init && npx @evalstudio/cli serve` — filesystem storage, zero setup, no `package.json` needed
- **Deployed server**: a `package.json` with `@evalstudio/cli` + `@evalstudio/postgres` as dependencies — Postgres storage, standard Node deployment

```json
{
  "dependencies": {
    "@evalstudio/cli": "^1.0.0",
    "@evalstudio/postgres": "^1.0.0"
  },
  "scripts": {
    "start": "evalstudio serve"
  }
}
```

Someone choosing Postgres is deploying a server — they already have a `package.json`, a `Dockerfile`, a deployment pipeline. Adding `@evalstudio/postgres` to their dependencies is one more line.

---

## Configuration

### evalstudio.config.json

Add a top-level `storage` field:

```json
{
  "version": 3,
  "name": "My Workspace",
  "storage": {
    "type": "postgres",
    "connectionString": "postgresql://user:pass@localhost:5432/evalstudio"
  },
  "projects": [],
  "llmSettings": { ... },
  "maxConcurrency": 5
}
```

When `storage` is omitted or `storage.type` is `"filesystem"`, behavior is identical to today — `projects/` directories, JSON files in `data/`, etc.

### Storage config types

```typescript
type StorageType = "filesystem" | "postgres";

interface FilesystemStorageConfig {
  type: "filesystem";
}

interface PostgresStorageConfig {
  type: "postgres";
  connectionString: string;
}

type StorageConfig = FilesystemStorageConfig | PostgresStorageConfig;
```

### Environment variable override

The connection string can also come from an environment variable, which takes precedence over the config file value. This avoids storing credentials in a checked-in file:

```json
{
  "storage": {
    "type": "postgres",
    "connectionString": "${EVALSTUDIO_DATABASE_URL}"
  }
}
```

The `${VAR}` syntax is resolved at config load time. Alternatively, if `EVALSTUDIO_DATABASE_URL` is set and the config has `"type": "postgres"` without a `connectionString`, the env var is used as fallback.

---

## What Changes with Postgres

### Projects: table instead of config array

With filesystem storage, the project registry lives in `evalstudio.config.json` under `projects[]`. With Postgres, projects are rows in a `projects` table. The config file's `projects` array is ignored (can be empty `[]`).

This means:
- `createProject()` inserts a row instead of appending to the JSON array
- `listProjects()` queries the table instead of reading the config file
- `deleteProject()` deletes the row (and cascades to entity tables) instead of removing from the array and deleting a directory
- Per-project config overrides (`llmSettings`, `maxConcurrency`) are columns on the `projects` table

### Entities: tables instead of JSON files

Each JSON file maps to a database table. Every entity table has a `project_id` column that scopes it to a project (replacing the filesystem isolation of `projects/{uuid}/data/`).

| JSON file | Table | Rows scoped by |
|---|---|---|
| `personas.json` | `personas` | `project_id` |
| `scenarios.json` | `scenarios` | `project_id` |
| `evals.json` | `evals` | `project_id` |
| `connectors.json` | `connectors` | `project_id` |
| `runs.json` | `runs` | `project_id` |
| `executions.json` | `executions` | `project_id` |

### ProjectContext

`ProjectContext` shape stays the same for consumers:

```typescript
interface ProjectContext {
  id: string;
  name: string;
  dataDir: string;        // Still used for filesystem mode; empty string for postgres
  workspaceDir: string;   // Still the workspace root (where config lives)
}
```

Entity modules don't need to know the storage type — they receive a `Repository<T>` that handles the difference.

---

## Database Schema

### Approach: reference columns + JSONB data

Foreign key references are real columns — this gives us `REFERENCES` constraints, cascade deletes, and indexable lookups. The rest of the entity payload lives in a JSONB `data` column to avoid mapping every field upfront.

The `data` column stores the full entity object (same shape as the JSON files). The reference columns are duplicated from `data` for relational integrity — the repository writes both when saving.

```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  llm_settings JSONB,
  max_concurrency INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Personas (no references to other entities)
CREATE TABLE personas (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  data JSONB NOT NULL
);
CREATE INDEX idx_personas_project ON personas(project_id);

-- Scenarios (references personas via personaIds)
CREATE TABLE scenarios (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  data JSONB NOT NULL
);
CREATE INDEX idx_scenarios_project ON scenarios(project_id);

-- Connectors (no references to other entities)
CREATE TABLE connectors (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  data JSONB NOT NULL
);
CREATE INDEX idx_connectors_project ON connectors(project_id);

-- Evals (references connector + scenarios)
CREATE TABLE evals (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  connector_id UUID NOT NULL REFERENCES connectors(id),
  data JSONB NOT NULL
);
CREATE INDEX idx_evals_project ON evals(project_id);
CREATE INDEX idx_evals_connector ON evals(connector_id);

-- Executions (references eval)
CREATE TABLE executions (
  id INTEGER NOT NULL,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  eval_id UUID NOT NULL REFERENCES evals(id),
  data JSONB NOT NULL,
  PRIMARY KEY (project_id, id)
);
CREATE INDEX idx_executions_project ON executions(project_id);
CREATE INDEX idx_executions_eval ON executions(eval_id);

-- Runs (references eval, scenario, persona, connector, execution)
CREATE TABLE runs (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  eval_id UUID REFERENCES evals(id),
  scenario_id UUID NOT NULL REFERENCES scenarios(id),
  persona_id UUID REFERENCES personas(id),
  connector_id UUID REFERENCES connectors(id),
  execution_id INTEGER,
  status TEXT NOT NULL,
  data JSONB NOT NULL
);
CREATE INDEX idx_runs_project ON runs(project_id);
CREATE INDEX idx_runs_status ON runs(project_id, status);
CREATE INDEX idx_runs_eval ON runs(project_id, eval_id);
CREATE INDEX idx_runs_scenario ON runs(project_id, scenario_id);
CREATE INDEX idx_runs_execution ON runs(project_id, execution_id);
```

Note: `scenarios.personaIds` is an array of UUIDs stored inside `data` — not a foreign key column. This mirrors the current JSON structure where scenarios embed persona ID references as an array field. A join table (`scenario_personas`) could be added later but is out of scope for the initial implementation.

Similarly, `evals.scenarioIds` is an array inside `data`. A join table (`eval_scenarios`) could follow later.

### Future: full explicit columns

The `data` column can be migrated to explicit columns incrementally as query needs grow. The reference columns and indexes are already in place — the remaining fields (messages, metadata, timestamps, etc.) can be promoted to columns without schema redesign.

---

## Core Changes

### StorageProvider abstraction

Core introduces a `StorageProvider` interface that encapsulates all storage operations. This is the seam between core's business logic and the storage backend.

```typescript
// packages/core/src/storage-provider.ts

interface StorageProvider {
  /** Create a repository for an entity type, scoped to a project */
  createRepository<T>(entity: string, projectId: string): Repository<T>;

  /** Project registry operations */
  listProjects(): Promise<ProjectInfo[]>;
  createProject(name: string): Promise<ProjectInfo>;
  deleteProject(projectId: string): Promise<void>;
  getProjectEntry(projectId: string): Promise<ProjectEntry>;
  updateProjectEntry(projectId: string, input: UpdateProjectConfigInput): Promise<ProjectEntry>;
}
```

Core ships with `FilesystemStorageProvider` — extracts the existing logic from `project-resolver.ts` and `createJsonRepository`:

```typescript
// packages/core/src/filesystem-storage.ts

function createFilesystemStorage(workspaceDir: string): StorageProvider {
  return {
    createRepository<T>(entity: string, projectId: string): Repository<T> {
      const dataDir = join(workspaceDir, "projects", projectId, "data");
      return createJsonRepository<T>(`${entity}.json`, dataDir);
    },

    async listProjects() {
      // Read from evalstudio.config.json projects[]
    },
    async createProject(name) {
      // mkdir + update config
    },
    async deleteProject(projectId) {
      // rmdir + update config
    },
    async getProjectEntry(projectId) {
      // Read from config projects[] array
    },
    async updateProjectEntry(projectId, input) {
      // Update config projects[] array
    },
  };
}
```

### Repository interface becomes async

```typescript
interface Repository<T> {
  findAll(): Promise<T[]>;
  saveAll(items: T[]): Promise<void>;
}
```

`createJsonRepository` wraps its synchronous fs calls in resolved promises to conform.

### Entity module factories accept injected repository

```typescript
// Before — entity creates its own repo
function createPersonaModule(ctx: ProjectContext) {
  const repo = createJsonRepository<Persona>("personas.json", ctx.dataDir);
  return {
    create(input: CreatePersonaInput): Persona { ... },
    get(id: string): Persona { ... },
    list(): Persona[] { ... },
  };
}

// After — repo is injected, methods are async
function createPersonaModule(repo: Repository<Persona>) {
  return {
    async create(input: CreatePersonaInput): Promise<Persona> { ... },
    async get(id: string): Promise<Persona> { ... },
    async list(): Promise<Persona[]> { ... },
  };
}
```

Entity modules no longer import any storage implementation. They don't know or care what's behind the `Repository<T>`.

### How CLI and API create modules

The caller creates the `StorageProvider`, then uses it to create repositories for each entity module:

```typescript
// Bootstrap (shared by CLI and API)
const storage = createStorageProvider(workspaceDir);  // filesystem or postgres
const ctx = await resolveProject(storage, projectId);

// Create entity modules with injected repositories
const personas = createPersonaModule(storage.createRepository<Persona>("personas", ctx.id));
const scenarios = createScenarioModule(storage.createRepository<Scenario>("scenarios", ctx.id));
const evals = createEvalModule(
  storage.createRepository<Eval>("evals", ctx.id),
  scenarios,   // for foreign key validation
  connectors,  // for foreign key validation
);
```

### Workspace config changes

```typescript
interface WorkspaceConfig extends ProjectConfig {
  storage?: StorageConfig;    // NEW — defaults to { type: "filesystem" }
  projects: ProjectEntry[];   // Ignored when storage.type === "postgres"
}
```

When `storage.type` is `"postgres"`:
- `projects[]` in the config file is not read or written
- Project CRUD operations go to the `projects` table
- Per-project config (`llmSettings`, `maxConcurrency`) is stored as columns on the `projects` table
- Workspace-level config (`name`, `llmSettings`, `maxConcurrency`) remains in the config file

---

## New Package: `@evalstudio/postgres`

### Package structure

```
packages/postgres/
  package.json
  src/
    index.ts                # Public API: createPostgresStorage()
    postgres-storage.ts     # StorageProvider implementation
    postgres-repository.ts  # Repository<T> implementation
    schema.ts               # CREATE TABLE SQL + schema init
    pool.ts                 # Connection pool management
```

### Dependencies

```json
{
  "name": "@evalstudio/postgres",
  "dependencies": {
    "pg": "^8.18.0",
    "@evalstudio/core": "workspace:*"
  }
}
```

`pg` (~820KB installed including sub-packages) is a regular dependency of this package only. Core, CLI, and API don't depend on it.

### Public API

Exports a single factory that returns a `StorageProvider`:

```typescript
// packages/postgres/src/index.ts

import type { StorageProvider } from "@evalstudio/core";

export function createPostgresStorage(connectionString: string): StorageProvider {
  const pool = new Pool({ connectionString });

  return {
    createRepository<T>(entity: string, projectId: string): Repository<T> {
      return createPostgresRepository<T>(pool, entity, projectId);
    },

    async listProjects() {
      const { rows } = await pool.query("SELECT id, name FROM projects");
      return rows;
    },

    async createProject(name) {
      const id = randomUUID();
      await pool.query(
        "INSERT INTO projects (id, name) VALUES ($1, $2)",
        [id, name],
      );
      return { id, name };
    },

    async deleteProject(projectId) {
      await pool.query("DELETE FROM projects WHERE id = $1", [projectId]);
      // CASCADE handles entity cleanup
    },

    async getProjectEntry(projectId) { ... },
    async updateProjectEntry(projectId, input) { ... },
  };
}

export async function initSchema(connectionString: string): Promise<void> {
  // Run CREATE TABLE statements
}
```

### Postgres repository implementation

```typescript
function createPostgresRepository<T>(
  pool: Pool,
  table: string,
  projectId: string,
): Repository<T> {
  return {
    async findAll(): Promise<T[]> {
      const { rows } = await pool.query(
        `SELECT data FROM ${table} WHERE project_id = $1`,
        [projectId],
      );
      return rows.map((r) => r.data as T);
    },

    async saveAll(items: T[]): Promise<void> {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(`DELETE FROM ${table} WHERE project_id = $1`, [projectId]);
        for (const item of items) {
          await client.query(
            `INSERT INTO ${table} (id, project_id, data) VALUES ($1, $2, $3)`,
            [(item as any).id, projectId, JSON.stringify(item)],
          );
        }
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    },
  };
}
```

### Connection pooling

A single `Pool` instance is created by `createPostgresStorage()` and shared across all repositories. The pool is cleaned up when the process exits. The caller (CLI/API) is responsible for calling `pool.end()` on shutdown.

---

## Wiring: How CLI and API Load the Storage Provider

The CLI and API read the config, then dynamically import `@evalstudio/postgres` only when needed:

```typescript
// packages/core/src/storage-factory.ts (exported from core)

async function createStorageProvider(workspaceDir: string): Promise<StorageProvider> {
  const config = readWorkspaceConfig(workspaceDir);

  if (config.storage?.type === "postgres") {
    let mod;
    try {
      mod = await import("@evalstudio/postgres");
    } catch {
      throw new Error(
        "PostgreSQL storage requires the @evalstudio/postgres package.\n" +
        "Install it with: npm install @evalstudio/postgres"
      );
    }
    const connectionString = resolveConnectionString(config.storage);
    return mod.createPostgresStorage(connectionString);
  }

  return createFilesystemStorage(workspaceDir);
}
```

The dynamic `import()` means:
- Filesystem users: `@evalstudio/postgres` is never loaded, doesn't need to be installed
- Postgres users: the package is resolved from local `node_modules` at runtime
- Missing package: clear error message telling the user what to install

CLI and API list `@evalstudio/postgres` as an optional peer dependency:

```json
{
  "peerDependencies": {
    "@evalstudio/postgres": "workspace:*"
  },
  "peerDependenciesMeta": {
    "@evalstudio/postgres": { "optional": true }
  }
}
```

---

## Migration

### Filesystem to Postgres

A CLI command migrates an existing filesystem workspace to Postgres:

```bash
evalstudio migrate --to postgres --connection-string "postgresql://..."
```

This:
1. Reads all projects from `evalstudio.config.json` `projects[]`
2. For each project, reads all JSON files from `projects/{uuid}/data/`
3. Inserts everything into the Postgres tables
4. Updates `evalstudio.config.json` to set `storage.type: "postgres"`

The filesystem data is left intact (not deleted) so the user can verify and roll back.

### Schema initialization

On first connection, the storage provider checks if the schema exists and creates it if not:

```bash
# Or explicitly via CLI
evalstudio db init --connection-string "postgresql://..."
```

Auto-migration on startup runs the schema creation SQL if tables don't exist. No ORM, no migration framework — just a versioned SQL script embedded in `@evalstudio/postgres`.

---

## Package Impact

### @evalstudio/core

| File | Change |
|---|---|
| `storage-provider.ts` | **New** — `StorageProvider` interface |
| `filesystem-storage.ts` | **New** — `FilesystemStorageProvider` (extracts logic from project-resolver + JSON repo) |
| `storage-factory.ts` | **New** — `createStorageProvider()` with dynamic import for postgres |
| `repository.ts` | `Repository<T>` methods return `Promise` |
| `project-resolver.ts` | Project CRUD delegates to `StorageProvider` |
| `project.ts` | `getProjectConfig` / `updateProjectConfig` delegate to `StorageProvider` |
| `persona.ts` | Accept injected `Repository<T>`, all methods become `async` |
| `scenario.ts` | Accept injected `Repository<T>`, all methods become `async` |
| `eval.ts` | Accept injected `Repository<T>`, all methods become `async` |
| `connector.ts` | Accept injected `Repository<T>`, all methods become `async` |
| `run.ts` | Accept injected `Repository<T>`, all methods become `async` |
| `execution.ts` | Accept injected `Repository<T>`, all methods become `async` |
| `run-processor.ts` | Await entity module calls |
| `evaluator.ts` | Already async (no change) |
| `index.ts` | Export `StorageProvider`, `createStorageProvider`, `createFilesystemStorage` |

### @evalstudio/postgres (new)

| File | Purpose |
|---|---|
| `index.ts` | Public API: `createPostgresStorage()`, `initSchema()` |
| `postgres-storage.ts` | `StorageProvider` implementation |
| `postgres-repository.ts` | `Repository<T>` implementation using `pg` |
| `schema.ts` | SQL schema definition + creation |
| `pool.ts` | Connection pool lifecycle |

### @evalstudio/cli

- All command handlers add `await` to entity module calls
- New commands: `evalstudio db init`, `evalstudio migrate --to postgres`

### @evalstudio/api

- Route handlers add `await` to entity module calls (most already return promises via Fastify)

### @evalstudio/web

No changes — the web client talks to the API, not to storage directly.

---

## Run Processor with Postgres

The `RunProcessor` currently polls JSON files for queued runs. With Postgres:

- Polling uses `SELECT ... WHERE status = 'queued' LIMIT n FOR UPDATE SKIP LOCKED` for safe concurrent processing
- Multiple `RunProcessor` instances can run against the same database without conflicts
- This is a significant advantage over filesystem storage, which requires a single processor

---

## Scope

### In scope

- `StorageProvider` interface in core with `FilesystemStorageProvider`
- `@evalstudio/postgres` package with `PostgresStorageProvider` (depends on `pg`)
- `storage` config field in `evalstudio.config.json` (`filesystem` default, `postgres` option)
- Dynamic import of `@evalstudio/postgres` when config says postgres
- `Repository<T>` becomes async
- Entity module factories accept injected `Repository<T>`
- Phase 1 JSONB `data` column schema
- Project CRUD via `projects` table when storage is postgres
- CLI `evalstudio db init` and `evalstudio migrate --to postgres` commands
- Connection pooling and cleanup

### Out of scope

- Phase 2 explicit-column schema (follow-up)
- Other databases (MySQL, SQLite) — can be added later by implementing `StorageProvider`
- Real-time change notifications (LISTEN/NOTIFY)
- Read replicas or connection routing
- Data encryption at rest
- Row-level security or multi-tenancy beyond project_id scoping
