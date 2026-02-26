---
sidebar_position: 7
---

# evalstudio llm-provider

View and configure the LLM provider used for evaluation judging and persona generation. The provider is stored in `evalstudio.config.json`.

## Usage

```bash
evalstudio llm-provider <command> [options]
```

## Commands

### set

Configure the LLM provider for the current project.

```bash
evalstudio llm-provider set [options]
```

| Option | Description |
|--------|-------------|
| `--provider <provider>` | Provider type: `openai` or `anthropic` (required) |
| `--api-key <key>` | API key for the provider (required) |

**Example:**

```bash
evalstudio llm-provider set \
  --provider openai \
  --api-key sk-your-api-key
```

Output:
```
LLM Provider configured successfully
  Provider: openai
  API Key:  sk-y...key
```

### show

Show the current LLM provider configuration.

```bash
evalstudio llm-provider show [options]
```

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |

**Example:**

```bash
evalstudio llm-provider show
```

Output:
```
LLM Provider:
  Provider: openai
  API Key:  sk-y...key
```

### models

List available models for each provider type.

```bash
evalstudio llm-provider models [options]
```

| Option | Description |
|--------|-------------|
| `--provider <provider>` | Filter by provider (`openai` or `anthropic`) |
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
  Standard:
    - gpt-5-mini
    - gpt-5-nano
    - gpt-4.1
    - gpt-4.1-mini
    - gpt-4.1-nano
    - o4-mini
    - o3-mini
    - gpt-4o
    - gpt-4o-mini
  Premium:
    - gpt-5.2-pro
    - gpt-5.2
    - gpt-5.1
    - gpt-5-pro
    - gpt-5
    - o3-pro
    - o3
    - o1-pro
    - o1

Anthropic:
  Standard:
    - claude-sonnet-4-5-20250929
    - claude-sonnet-4-20250514
    - claude-3-5-sonnet-20241022
    - claude-3-5-haiku-20241022
  Premium:
    - claude-opus-4-5-20251101
    - claude-opus-4-20250514
```

## JSON Output

The `show` and `models` commands support the `--json` flag for machine-readable output.

```bash
evalstudio llm-provider show --json
```

Output:
```json
{
  "provider": "openai",
  "apiKey": "sk-your-api-key"
}
```
