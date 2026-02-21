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
| `-d, --description <text>` | Short description of the persona |
| `-s, --system-prompt <prompt>` | Full description / system prompt for this persona |
| `--header <key:value>` | HTTP header as key:value pair (repeatable) |
| `--json` | Output as JSON |

**Example:**

```bash
evalstudio persona create impatient-user \
  -d "A user who wants quick answers" \
  -s "You are an impatient user who values brevity and expects quick, concise responses." \
  --header "X-User-Language:en" --header "X-User-Tier:premium"
```

Output:
```
Persona created successfully
  ID:          987fcdeb-51a2-3bc4-d567-890123456789
  Name:        impatient-user
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
| `--json` | Output as JSON |

**Example:**

```bash
evalstudio persona list
```

Output:
```
Personas:
---------
  impatient-user (987fcdeb-51a2-3bc4-d567-890123456789)
    A user who wants quick answers
  technical-user (abc12345-6789-def0-1234-567890abcdef)
    A technically savvy user
```

### show

Show persona details.

```bash
evalstudio persona show <identifier> [options]
```

The identifier can be the persona ID or name.

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |

**Example:**

```bash
evalstudio persona show impatient-user
```

Output:
```
Persona: impatient-user
---------
  ID:          987fcdeb-51a2-3bc4-d567-890123456789
  Name:        impatient-user
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
| `--header <key:value>` | HTTP header as key:value pair (repeatable) |
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
evalstudio persona list --json
```

Output:
```json
[
  {
    "id": "987fcdeb-51a2-3bc4-d567-890123456789",
    "name": "impatient-user",
    "description": "A user who wants quick answers",
    "systemPrompt": "You are an impatient user who values brevity and expects quick, concise responses.",
    "createdAt": "2026-01-28T10:00:00.000Z",
    "updatedAt": "2026-01-28T10:00:00.000Z"
  }
]
```
