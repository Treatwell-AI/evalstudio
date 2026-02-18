---
sidebar_position: 6
---

# LLM Providers API

REST endpoints for querying available LLM models. The LLM provider itself is configured via the project config (`PUT /api/project` with `llmProvider` field) — there are no separate CRUD endpoints.

## Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/llm-providers/models` | List default models per provider type |
| GET | `/api/llm-providers/:providerType/models` | Fetch models dynamically from provider API |

---

## GET /api/llm-providers/models

Get available models for each provider type (static defaults).

### Response (200 OK)

```json
{
  "openai": [
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-4-turbo",
    "gpt-3.5-turbo"
  ],
  "anthropic": [
    "claude-sonnet-4-20250514",
    "claude-3-5-sonnet-20241022",
    "claude-3-5-haiku-20241022",
    "claude-3-opus-20240229"
  ]
}
```

### Example

```bash
curl http://localhost:3000/api/llm-providers/models
```

---

## GET /api/llm-providers/:providerType/models

Fetch available models dynamically from the provider's API using the API key from the project config. For OpenAI, this queries the `/v1/models` endpoint. For Anthropic, returns the default model list.

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `providerType` | string | Provider type: `openai` or `anthropic` |

### Response (200 OK)

```json
{
  "models": [
    "gpt-4.1",
    "gpt-4.1-mini",
    "gpt-4o",
    "gpt-4o-mini",
    "o1",
    "o1-mini"
  ]
}
```

### Errors

| Status | Description |
|--------|-------------|
| 400 | No LLM provider configured in project |
| 500 | Failed to fetch models from provider API |

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
    "llmProvider": {
      "provider": "openai",
      "apiKey": "sk-your-api-key"
    },
    "llmSettings": {
      "evaluation": { "model": "gpt-4o" },
      "persona": { "model": "gpt-4o-mini" }
    }
  }'
```

See [Project API](./projects.md) for full details.
