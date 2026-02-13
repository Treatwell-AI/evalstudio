---
sidebar_position: 6
---

# evalstudio llm-provider

Manage LLM provider configurations for persona simulation and evaluation. LLM providers define the provider credentials used during eval execution.

## Usage

```bash
evalstudio llm-provider <command> [options]
```

## Commands

### create

Create a new LLM provider configuration.

```bash
evalstudio llm-provider create <name> [options]
```

| Option | Description |
|--------|-------------|
| `--provider <provider>` | Provider type: openai or anthropic (required) |
| `--api-key <key>` | API key for the provider (required) |
| `--json` | Output as JSON |

**Example:**

```bash
evalstudio llm-provider create "Production OpenAI" \
  --provider openai \
  --api-key sk-your-api-key
```

Output:
```
LLM Provider created successfully
  ID:       987fcdeb-51a2-3bc4-d567-890123456789
  Name:     Production OpenAI
  Provider: openai
  API Key:  sk-y...key
  Created:  2026-01-28T10:00:00.000Z
```

### list

List LLM provider configurations.

```bash
evalstudio llm-provider list [options]
```

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |

**Example:**

```bash
evalstudio llm-provider list
```

Output:
```
LLM Providers:
--------------
  Production OpenAI (987fcdeb-51a2-3bc4-d567-890123456789)
    Provider: openai
  Anthropic Claude (abc12345-6789-def0-1234-567890abcdef)
    Provider: anthropic
```

### show

Show LLM provider details.

```bash
evalstudio llm-provider show <identifier> [options]
```

The identifier can be the provider ID or name.

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |

**Example:**

```bash
evalstudio llm-provider show "Production OpenAI"
```

Output:
```
LLM Provider: Production OpenAI
--------------
  ID:       987fcdeb-51a2-3bc4-d567-890123456789
  Name:     Production OpenAI
  Provider: openai
  API Key:  sk-y...key
  Created:  2026-01-28T10:00:00.000Z
  Updated:  2026-01-28T10:00:00.000Z
```

### update

Update an LLM provider configuration.

```bash
evalstudio llm-provider update <identifier> [options]
```

| Option | Description |
|--------|-------------|
| `-n, --name <name>` | New provider name |
| `--provider <provider>` | New provider type (openai or anthropic) |
| `--api-key <key>` | New API key |
| `--json` | Output as JSON |

**Example:**

```bash
evalstudio llm-provider update 987fcdeb-51a2-3bc4-d567-890123456789 \
  --name "Updated Provider Name"
```

### delete

Delete an LLM provider configuration.

```bash
evalstudio llm-provider delete <identifier> [options]
```

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |

**Example:**

```bash
evalstudio llm-provider delete 987fcdeb-51a2-3bc4-d567-890123456789
```

Output:
```
LLM Provider "Production OpenAI" deleted successfully
```

### models

List available models for each provider.

```bash
evalstudio llm-provider models [options]
```

| Option | Description |
|--------|-------------|
| `--provider <provider>` | Filter by provider (openai or anthropic) |
| `--json` | Output as JSON |

**Example:**

```bash
evalstudio llm-provider models
```

Output:
```
Available Models:
-----------------

OpenAI:
  - gpt-4o
  - gpt-4o-mini
  - gpt-4-turbo
  - gpt-3.5-turbo

Anthropic:
  - claude-sonnet-4-20250514
  - claude-3-5-sonnet-20241022
  - claude-3-5-haiku-20241022
  - claude-3-opus-20240229
```

## JSON Output

All commands support the `--json` flag for machine-readable output, useful for scripts and CI/CD pipelines.

```bash
evalstudio llm-provider list --json
```

Output:
```json
[
  {
    "id": "987fcdeb-51a2-3bc4-d567-890123456789",
    "name": "Production OpenAI",
    "provider": "openai",
    "apiKey": "sk-your-api-key",
    "createdAt": "2026-01-28T10:00:00.000Z",
    "updatedAt": "2026-01-28T10:00:00.000Z"
  }
]
```
