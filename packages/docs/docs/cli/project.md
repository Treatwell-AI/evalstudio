---
sidebar_position: 2
---

# evalstudio project

Manage projects to organize different evaluation contexts.

## Usage

```bash
evalstudio project <command> [options]
```

## Commands

### create

Create a new project.

```bash
evalstudio project create <name> [options]
```

| Option | Description |
|--------|-------------|
| `-d, --description <text>` | Project description |
| `--json` | Output as JSON |

**Example:**

```bash
evalstudio project create my-product -d "Evaluations for my product"
```

Output:
```
Project created successfully
  ID:          123e4567-e89b-12d3-a456-426614174000
  Name:        my-product
  Description: Evaluations for my product
  Created:     2026-01-28T10:00:00.000Z
```

### list

List all projects.

```bash
evalstudio project list [options]
```

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |

**Example:**

```bash
evalstudio project list
```

Output:
```
Projects:
---------
  my-product (123e4567-e89b-12d3-a456-426614174000)
    Evaluations for my product
  another-project (987fcdeb-51a2-3bc4-d567-890123456789)
```

### show

Show project details.

```bash
evalstudio project show <identifier> [options]
```

The identifier can be either the project ID or name.

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |

**Example:**

```bash
evalstudio project show my-product
```

Output:
```
Project: my-product
---------
  ID:          123e4567-e89b-12d3-a456-426614174000
  Name:        my-product
  Description: Evaluations for my product
  Created:     2026-01-28T10:00:00.000Z
  Updated:     2026-01-28T10:00:00.000Z
```

### update

Update a project.

```bash
evalstudio project update <identifier> [options]
```

| Option | Description |
|--------|-------------|
| `-n, --name <name>` | New project name |
| `-d, --description <text>` | New project description |
| `--json` | Output as JSON |

**Example:**

```bash
evalstudio project update my-product -d "Updated description"
```

### delete

Delete a project.

```bash
evalstudio project delete <identifier> [options]
```

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |

**Example:**

```bash
evalstudio project delete my-product
```

Output:
```
Project "my-product" deleted successfully
```

## LLM Settings

Configure LLM providers and models for evaluation and persona generation at the project level.

### llm-settings show

Show current LLM settings for a project.

```bash
evalstudio project llm-settings show <identifier> [options]
```

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |

**Example:**

```bash
evalstudio project llm-settings show my-product
```

Output:
```
Project LLM Settings: my-product
─────────────────────────────────
Evaluation:
  Provider: openai-prod (openai)
  Model: gpt-4o
Persona Generation:
  Provider: (uses evaluation provider)
  Model: (uses evaluation model)
```

### llm-settings set

Set LLM providers and models for a project.

```bash
evalstudio project llm-settings set <identifier> [options]
```

| Option | Description |
|--------|-------------|
| `--evaluation-provider <id>` | Provider ID for evaluation/judging |
| `--evaluation-model <model>` | Model for evaluation (optional) |
| `--persona-provider <id>` | Provider ID for persona generation (optional, falls back to evaluation) |
| `--persona-model <model>` | Model for persona generation (optional) |
| `--json` | Output as JSON |

**Example:**

```bash
# Set evaluation provider
evalstudio project llm-settings set my-product \
  --evaluation-provider openai-prod \
  --evaluation-model gpt-4o

# Set separate persona provider
evalstudio project llm-settings set my-product \
  --persona-provider anthropic-prod \
  --persona-model claude-3-5-sonnet-20241022
```

### llm-settings clear

Clear all LLM settings for a project.

```bash
evalstudio project llm-settings clear <identifier> [options]
```

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |

**Example:**

```bash
evalstudio project llm-settings clear my-product
```

## JSON Output

All commands support the `--json` flag for machine-readable output, useful for scripts and CI/CD pipelines.

```bash
evalstudio project list --json
```

Output:
```json
[
  {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "my-product",
    "description": "Evaluations for my product",
    "createdAt": "2026-01-28T10:00:00.000Z",
    "updatedAt": "2026-01-28T10:00:00.000Z"
  }
]
```
