---
sidebar_position: 7
---

# evalstudio connector

Manage connector configurations for bridging EvalStudio to external API endpoints. Connectors define how to connect to target systems like LangGraph Dev API or generic HTTP endpoints.

## Usage

```bash
evalstudio connector <command> [options]
```

## Commands

### create

Create a new connector configuration.

```bash
evalstudio connector create <name> [options]
```

| Option | Description |
|--------|-------------|
| `-p, --project <project>` | Project ID or name (required) |
| `--type <type>` | Connector type: http or langgraph (required) |
| `--base-url <url>` | Base URL for the API endpoint (required) |
| `--auth-type <authType>` | Authentication type: none, api-key, bearer, basic |
| `--auth-value <value>` | Authentication value (API key, token, credentials) |
| `--config <json>` | Configuration as JSON string |
| `--json` | Output as JSON |

**Example:**

```bash
# HTTP connector
evalstudio connector create "Production API" \
  -p my-product \
  --type http \
  --base-url https://api.example.com \
  --auth-type bearer \
  --auth-value my-token

# LangGraph connector (assistantId is required in config)
evalstudio connector create "LangGraph Dev" \
  -p my-product \
  --type langgraph \
  --base-url http://localhost:8123 \
  --config '{"assistantId": "my-assistant"}'
```

Output:
```
Connector created successfully
  ID:       987fcdeb-51a2-3bc4-d567-890123456789
  Name:     LangGraph Dev
  Project:  my-product
  Type:     langgraph
  Base URL: http://localhost:8123
  Config:   {"assistantId":"my-assistant"}
  Created:  2026-01-29T10:00:00.000Z
```

### list

List connector configurations.

```bash
evalstudio connector list [options]
```

| Option | Description |
|--------|-------------|
| `-p, --project <project>` | Filter by project ID or name |
| `--json` | Output as JSON |

**Example:**

```bash
evalstudio connector list -p my-product
```

Output:
```
Connectors:
-----------
  LangGraph Dev (987fcdeb-51a2-3bc4-d567-890123456789)
    Project:  my-product
    Type:     langgraph
    Base URL: http://localhost:8123
  Production API (abc12345-6789-def0-1234-567890abcdef)
    Project:  my-product
    Type:     http
    Base URL: https://api.example.com
```

### show

Show connector details.

```bash
evalstudio connector show <identifier> [options]
```

| Option | Description |
|--------|-------------|
| `-p, --project <project>` | Project ID or name (for lookup by name) |
| `--json` | Output as JSON |

**Example:**

```bash
evalstudio connector show "LangGraph Dev" -p my-product
```

Output:
```
Connector: LangGraph Dev
-----------
  ID:       987fcdeb-51a2-3bc4-d567-890123456789
  Name:     LangGraph Dev
  Project:  my-product
  Type:     langgraph
  Base URL: http://localhost:8123
  Config:   {"assistantId":"my-assistant"}
  Created:  2026-01-29T10:00:00.000Z
  Updated:  2026-01-29T10:00:00.000Z
```

### update

Update a connector configuration.

```bash
evalstudio connector update <identifier> [options]
```

| Option | Description |
|--------|-------------|
| `-n, --name <name>` | New connector name |
| `--type <type>` | New connector type (http or langgraph) |
| `--base-url <url>` | New base URL |
| `--auth-type <authType>` | New authentication type |
| `--auth-value <value>` | New authentication value |
| `--config <json>` | New configuration as JSON string |
| `--json` | Output as JSON |

**Example:**

```bash
evalstudio connector update 987fcdeb-51a2-3bc4-d567-890123456789 \
  --base-url http://localhost:8124 \
  --config '{"assistantId": "new-assistant"}'
```

### delete

Delete a connector configuration.

```bash
evalstudio connector delete <identifier> [options]
```

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |

**Example:**

```bash
evalstudio connector delete 987fcdeb-51a2-3bc4-d567-890123456789
```

Output:
```
Connector "LangGraph Dev" deleted successfully
```

### types

List available connector types.

```bash
evalstudio connector types [options]
```

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |

**Example:**

```bash
evalstudio connector types
```

Output:
```
Available Connector Types:
--------------------------
  http
    Generic HTTP/REST API connector
  langgraph
    LangGraph Dev API connector for langgraph-backed agents
```

## JSON Output

All commands support `--json` for machine-readable output:

```bash
evalstudio connector list -p my-product --json
```

```json
[
  {
    "id": "987fcdeb-51a2-3bc4-d567-890123456789",
    "projectId": "123e4567-e89b-12d3-a456-426614174000",
    "name": "LangGraph Dev",
    "type": "langgraph",
    "baseUrl": "http://localhost:8123",
    "config": {
      "assistantId": "my-assistant"
    },
    "createdAt": "2026-01-29T10:00:00.000Z",
    "updatedAt": "2026-01-29T10:00:00.000Z"
  }
]
```
