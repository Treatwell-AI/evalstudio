---
sidebar_position: 2
---

# evalstudio init

Initialize a new EvalStudio project directory.

## Usage

```bash
evalstudio init [directory]
```

Creates a project directory with:
- `evalstudio.config.json` — project configuration (commit to git)
- `data/` — entity data storage

If no directory is specified, the current directory is initialized.

**Example:**

```bash
evalstudio init my-evals
cd my-evals
```

Output:
```
Project initialized in ./my-evals
  Config: my-evals/evalstudio.config.json
  Data:   my-evals/data/
```

## Project Configuration

The project is defined by the `evalstudio.config.json` file. You can edit it directly, update it via the API (`PUT /api/project`), or use the CLI `config` command.

```json
{
  "name": "my-product-evals",
  "maxConcurrency": 5,
  "llmSettings": {
    "evaluation": {
      "providerId": "provider-uuid",
      "model": "gpt-4o"
    },
    "persona": {
      "providerId": "provider-uuid",
      "model": "gpt-4o-mini"
    }
  }
}
```

## evalstudio config

View or update project configuration values from the CLI.

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

EvalStudio resolves the project directory in this order:

1. `EVALSTUDIO_PROJECT_DIR` — environment variable override
2. **Local project** — walks up from `cwd` looking for `evalstudio.config.json`

```bash
# Override project directory
export EVALSTUDIO_PROJECT_DIR=/path/to/project
evalstudio status
```
