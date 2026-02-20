---
sidebar_position: 2
---

# evalstudio init & projects

Commands for initializing workspaces and managing projects.

## evalstudio init

Initialize a new EvalStudio workspace with a first project.

### Usage

```bash
evalstudio init [directory]
```

Creates a workspace directory with:
- `evalstudio.config.json` — workspace configuration with project registry and per-project settings
- `projects/<uuid>/data/` — entity data storage

If no directory is specified, the current directory is initialized.

**Example:**

```bash
evalstudio init my-evals
cd my-evals
```

Output:
```
Workspace initialized in ./my-evals
  Config: my-evals/evalstudio.config.json
  Project: my-product-evals (a1b2c3d4)
```

## evalstudio projects

Manage projects within a workspace.

### List Projects

```bash
evalstudio projects list
evalstudio projects list --json
```

### Create Project

```bash
evalstudio projects create -n "staging-tests"
```

### Show Project

```bash
evalstudio projects show <identifier>
```

The identifier can be a project ID, ID prefix, or name.

### Update Project

```bash
evalstudio projects update <identifier> -n "new-name"
```

### Delete Project

```bash
evalstudio projects delete <identifier>
```

## evalstudio config

View or update the current project's configuration.

### Show Configuration

```bash
evalstudio config show
evalstudio config show --json
```

### Set Configuration

```bash
evalstudio config set name "my-new-project-name"
evalstudio config set maxConcurrency 10
```

Supported keys: `name`, `maxConcurrency`.

## Project Directory Resolution

EvalStudio resolves the project context in this order:

1. **Inside a project directory** — walks up from `cwd` looking for `projects/{uuid}/` structure, verifies project is registered in workspace config
2. **At workspace root with one project** — auto-selects the single project
3. **At workspace root with multiple projects** — prompts to use `evalstudio use <project>` to switch
4. `EVALSTUDIO_PROJECT_DIR` — environment variable override

```bash
# Navigate into a project directory
cd projects/a1b2c3d4
evalstudio status  # uses that project

# Or override via environment variable
export EVALSTUDIO_PROJECT_DIR=/path/to/workspace
evalstudio status
```

## evalstudio db

Database management commands for PostgreSQL storage.

### Initialize Schema

```bash
evalstudio db init
evalstudio db init --connection-string "postgresql://user:pass@localhost:5432/evalstudio"
```

Runs all pending database migrations and creates tables/indexes. If the database has no projects, creates a "default" project. Safe to run on every startup — already-applied migrations are skipped.

The connection string is resolved from (in order):
1. `--connection-string` CLI option
2. `storage.connectionString` in `evalstudio.config.json`
3. `EVALSTUDIO_DATABASE_URL` environment variable

### Migration Status

```bash
evalstudio db status
evalstudio db status --connection-string "postgresql://user:pass@localhost:5432/evalstudio"
```

Shows which database migrations have been applied and which are pending.

## Workspace Structure

```
my-evals/
  evalstudio.config.json          # Workspace config + project registry + per-project settings
  projects/
    a1b2c3d4-.../
      data/
        personas.json
        scenarios.json
        evals.json
        runs.json
        executions.json
        connectors.json
    f9e8d7c6-.../
      data/
        ...
```
