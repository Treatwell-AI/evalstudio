# Spec: Remove Project Entity, Use Config File as Project Definition

## Summary

Eliminate the `Project` entity and `projectId` foreign key from all entities. The presence of `evalstudio.config.json` in a directory defines a project. Project-level settings (name, llmSettings) move into that config file. The global `~/.evalstudio/` fallback is removed — `evalstudio init` is always required.

## Motivation

- `projectId` is threaded through every entity (persona, scenario, eval, connector, llm-provider, run, execution) adding accidental complexity
- Local project mode (`evalstudio.config.json` + `.evalstudio/` folder) already provides project-per-folder isolation, making multi-project-in-one-store redundant
- Aligns with standard dev tool conventions (one folder = one project)
- Simplifies the UI: no project list/selector, go straight to dashboard

## Design

### Project Definition

`evalstudio.config.json` becomes the single source of project identity and settings:

```json
{
  "version": 2,
  "name": "my-chatbot-eval",
  "llmSettings": {
    "evaluation": { "providerId": "<uuid>", "model": "gpt-4o" },
    "persona": { "providerId": "<uuid>", "model": "claude-sonnet-4-5-20250929" }
  }
}
```

- `version`: Schema version (bump to 2 to distinguish from current `{ version: 1 }`)
- `name`: Project name (required, defaults to folder name during `init`)
- `llmSettings`: Optional default LLM settings for evaluation and persona generation (references LLM providers by ID, same structure as current `ProjectLLMSettings`)

### Storage

- `.evalstudio/` directory (sibling to config file) stores all entity JSON files: `personas.json`, `scenarios.json`, `evals.json`, `connectors.json`, `llm-providers.json`, `runs.json`, `executions.json`
- `projects.json` is removed entirely
- No global `~/.evalstudio/` fallback — if no `evalstudio.config.json` is found, commands error with a message to run `evalstudio init`

### Entity Changes

Remove `projectId` field from all entities:

- `Persona` — drop `projectId`
- `Scenario` — drop `projectId`
- `Eval` — drop `projectId`
- `Connector` — drop `projectId`
- `LLMProvider` — drop `projectId`
- `Run` — drop `projectId`
- `Execution` — drop `projectId`

All CRUD functions lose their `projectId` parameter. Filtering by project is implicit — you only see entities from the current project's `.evalstudio/` folder.

### Core Changes

#### `storage.ts`

- Remove `discoverLocalStorageDir()` walk-up logic and global fallback
- `getStorageDir()` walks up from cwd to find `evalstudio.config.json`, returns sibling `.evalstudio/` dir. Throws if not found (no fallback)
- Add `getConfigPath()` — returns path to nearest `evalstudio.config.json` (throws if not found)
- Add `readProjectConfig()` — reads and parses `evalstudio.config.json`, returns typed config object
- Add `writeProjectConfig(config)` — writes config back to file
- `initLocalProject()` — keep but update to write `version: 2` config with required `name` field

#### `project.ts`

- Remove entirely (or repurpose as thin wrapper around config read/write)
- Replace with functions that operate on `evalstudio.config.json`:
  - `getProjectConfig(): ProjectConfig` — reads config file
  - `updateProjectConfig(input): ProjectConfig` — updates config file
- No more `createProject`, `deleteProject`, `listProjects`, `getProject`, `getProjectByName`
- Drop `description` field entirely (project identity is just `name`)

#### All entity modules (persona.ts, scenario.ts, eval.ts, connector.ts, llm-provider.ts, run.ts, execution.ts)

- Remove `projectId` from interfaces, `CreateInput` types, `UpdateInput` types
- Remove `projectId` parameter from all CRUD functions (`create`, `list`, `get`, `update`, `delete`)
- Remove `projectId` filtering in `list` functions (all entities in storage belong to current project)
- Update validation: remove `projectId` ownership checks (e.g., "provider belongs to this project")

### CLI Changes

- `evalstudio init` — remains the entry point, writes `evalstudio.config.json` with `name` and `.evalstudio/` dir
  - Default project name is the current folder name (e.g. `init` inside `my-chatbot-eval/` defaults name to `my-chatbot-eval`)
  - User is prompted to confirm or override the name
- Remove project selection commands/flags (`--project`, project switching)
- All commands operate on the project found by walking up from cwd
- Commands error clearly if no project found: `"No evalstudio project found. Run 'evalstudio init' to create one."`

### API Changes

- Remove `/api/projects` endpoints (list, create, get, update, delete)
- Add `/api/project` (singular) endpoint for reading/updating the current project config
- Remove `projectId` from all route params and query strings
- All entity endpoints (`/api/personas`, `/api/scenarios`, etc.) operate on the current project implicitly
- Server is bound to a project directory at startup (cwd or `--dir` flag)

### Web UI Changes

- Remove project list page
- Remove project selector/switcher
- Landing page goes straight to dashboard
- Settings page reads/writes project config via `GET/PUT /api/project`
- Remove `projectId` from all API calls and query keys
- Remove `projectId` from URL routing

## Out of Scope

- Moving LLM providers into `evalstudio.config.json` (separate change)
- Migration path from v1 (not needed, feature is unused)
- Multi-project support within a single storage directory

## File Impact Summary

### Delete
- `packages/core/src/project.ts` (replace with config-based functions)
- `packages/core/src/__tests__/project.test.ts` (if exists)
- All `projects.json` storage files

### Heavy Modifications
- `packages/core/src/storage.ts` — new config read/write, remove global fallback
- `packages/core/src/persona.ts` — drop projectId
- `packages/core/src/scenario.ts` — drop projectId
- `packages/core/src/eval.ts` — drop projectId
- `packages/core/src/connector.ts` — drop projectId
- `packages/core/src/llm-provider.ts` — drop projectId
- `packages/core/src/run.ts` — drop projectId
- `packages/core/src/execution.ts` — drop projectId
- `packages/core/src/run-processor.ts` — drop projectId from run creation
- All corresponding test files
- `packages/api/src/routes/` — all route files (drop projectId params, replace project routes)
- `packages/cli/src/commands/` — all command files (drop project selection)
- `packages/web/src/pages/` — remove project pages, update all API calls
- `packages/web/src/lib/` — update API client

### Light Modifications
- `packages/core/src/evaluator.ts` — if it references projectId
- `packages/core/src/index.ts` — update exports
