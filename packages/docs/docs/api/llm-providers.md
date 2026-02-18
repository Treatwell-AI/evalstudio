---
sidebar_position: 6
---

# LLM Providers API

REST endpoints for querying available LLM models. The LLM provider itself is configured via the project config (`PUT /api/project` with `llmSettings` field) — there are no separate CRUD endpoints.

## Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/llm-providers/models` | List grouped models per provider type |
| GET | `/api/llm-providers/:providerType/models` | Get model groups for a specific provider |

---

## GET /api/llm-providers/models

Get available models for each provider type, grouped by tier (Standard, Premium).

### Response (200 OK)

```json
{
  "openai": [
    {
      "label": "Standard",
      "models": ["gpt-5-mini", "gpt-5-nano", "gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano", "o4-mini", "o3-mini", "gpt-4o", "gpt-4o-mini"]
    },
    {
      "label": "Premium",
      "models": ["gpt-5.2-pro", "gpt-5.2", "gpt-5.1", "gpt-5-pro", "gpt-5", "o3-pro", "o3", "o1-pro", "o1"]
    }
  ],
  "anthropic": [
    {
      "label": "Standard",
      "models": ["claude-sonnet-4-5-20250929", "claude-sonnet-4-20250514", "claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022"]
    },
    {
      "label": "Premium",
      "models": ["claude-opus-4-5-20251101", "claude-opus-4-20250514"]
    }
  ]
}
```

### Example

```bash
curl http://localhost:3000/api/llm-providers/models
```

---

## GET /api/llm-providers/:providerType/models

Get model groups for a specific provider type.

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `providerType` | string | Provider type: `openai` or `anthropic` |

### Response (200 OK)

```json
{
  "groups": [
    {
      "label": "Standard",
      "models": ["gpt-5-mini", "gpt-5-nano", "gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano", "o4-mini", "o3-mini", "gpt-4o", "gpt-4o-mini"]
    },
    {
      "label": "Premium",
      "models": ["gpt-5.2-pro", "gpt-5.2", "gpt-5.1", "gpt-5-pro", "gpt-5", "o3-pro", "o3", "o1-pro", "o1"]
    }
  ]
}
```

### Errors

| Status | Description |
|--------|-------------|
| 400 | Invalid provider type |

### Example

```bash
curl http://localhost:3000/api/llm-providers/openai/models
```

---

## Configuring the LLM Provider

The LLM provider is set via the project config endpoint:

```bash
curl -X PUT http://localhost:3000/api/project \
  -H "Content-Type: application/json" \
  -d '{
    "llmSettings": {
      "provider": "openai",
      "apiKey": "sk-your-api-key",
      "models": {
        "evaluation": "gpt-4o",
        "persona": "gpt-4o-mini"
      }
    }
  }'
```

See [Project API](./projects.md) for full details.
