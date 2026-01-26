---
sidebar_position: 3
---

# evalstudio persona

Manage personas for testing scenarios. Personas simulate different user interactions and behaviors.

## Usage

```bash
evalstudio persona <command> [options]
```

## Commands

### create

Create a new persona.

```bash
evalstudio persona create <name> [options]
```

| Option | Description |
|--------|-------------|
| `-p, --project <project>` | Project ID or name (required) |
| `-d, --description <text>` | Short description of the persona |
| `-s, --system-prompt <prompt>` | Full description / system prompt for this persona |
| `--json` | Output as JSON |

**Example:**

```bash
evalstudio persona create impatient-user \
  -p my-product \
  -d "A user who wants quick answers" \
  -s "You are an impatient user who values brevity and expects quick, concise responses."
```

Output:
```
Persona created successfully
  ID:          987fcdeb-51a2-3bc4-d567-890123456789
  Name:        impatient-user
  Project:     my-product
  Description: A user who wants quick answers
  System:      You are an impatient user who values brevity and expects quick, concise responses.
  Created:     2026-01-28T10:00:00.000Z
```

### list

List personas.

```bash
evalstudio persona list [options]
```

| Option | Description |
|--------|-------------|
| `-p, --project <project>` | Filter by project ID or name |
| `--json` | Output as JSON |

**Example:**

```bash
evalstudio persona list -p my-product
```

Output:
```
Personas:
---------
  impatient-user (987fcdeb-51a2-3bc4-d567-890123456789)
    Project: my-product
    A user who wants quick answers
  technical-user (abc12345-6789-def0-1234-567890abcdef)
    Project: my-product
    A technically savvy user
```

### show

Show persona details.

```bash
evalstudio persona show <identifier> [options]
```

The identifier is the persona ID. Use `-p` option to look up by name instead.

| Option | Description |
|--------|-------------|
| `-p, --project <project>` | Project ID or name (for lookup by name) |
| `--json` | Output as JSON |

**Example:**

```bash
evalstudio persona show impatient-user -p my-product
```

Output:
```
Persona: impatient-user
---------
  ID:          987fcdeb-51a2-3bc4-d567-890123456789
  Name:        impatient-user
  Project:     my-product
  Description: A user who wants quick answers
  System:      You are an impatient user who values brevity and expects quick, concise responses.
  Created:     2026-01-28T10:00:00.000Z
  Updated:     2026-01-28T10:00:00.000Z
```

### update

Update a persona.

```bash
evalstudio persona update <identifier> [options]
```

| Option | Description |
|--------|-------------|
| `-n, --name <name>` | New persona name |
| `-d, --description <text>` | New short description |
| `-s, --system-prompt <prompt>` | New system prompt |
| `--json` | Output as JSON |

**Example:**

```bash
evalstudio persona update 987fcdeb-51a2-3bc4-d567-890123456789 \
  -s "You are a technical user who expects detailed, accurate responses."
```

### delete

Delete a persona.

```bash
evalstudio persona delete <identifier> [options]
```

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |

**Example:**

```bash
evalstudio persona delete 987fcdeb-51a2-3bc4-d567-890123456789
```

Output:
```
Persona "impatient-user" deleted successfully
```

## JSON Output

All commands support the `--json` flag for machine-readable output, useful for scripts and CI/CD pipelines.

```bash
evalstudio persona list -p my-product --json
```

Output:
```json
[
  {
    "id": "987fcdeb-51a2-3bc4-d567-890123456789",
    "projectId": "123e4567-e89b-12d3-a456-426614174000",
    "name": "impatient-user",
    "description": "A user who wants quick answers",
    "systemPrompt": "You are an impatient user who values brevity and expects quick, concise responses.",
    "createdAt": "2026-01-28T10:00:00.000Z",
    "updatedAt": "2026-01-28T10:00:00.000Z"
  }
]
```
