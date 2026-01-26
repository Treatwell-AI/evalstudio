---
sidebar_position: 6
---

# LLM Providers API

REST endpoints for managing LLM provider configurations. LLM providers belong to a project and define the provider credentials used during eval execution.

## Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/llm-providers` | List LLM providers |
| GET | `/api/llm-providers/models` | List default models per provider type |
| GET | `/api/llm-providers/:id/models` | Fetch models dynamically from provider API |
| POST | `/api/llm-providers` | Create an LLM provider |
| GET | `/api/llm-providers/:id` | Get an LLM provider by ID |
| PUT | `/api/llm-providers/:id` | Update an LLM provider |
| DELETE | `/api/llm-providers/:id` | Delete an LLM provider |

---

## GET /api/llm-providers

List LLM providers, optionally filtered by project.

### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `projectId` | string | Filter by project ID |

### Response (200 OK)

```json
[
  {
    "id": "987fcdeb-51a2-3bc4-d567-890123456789",
    "projectId": "123e4567-e89b-12d3-a456-426614174000",
    "name": "Production OpenAI",
    "provider": "openai",
    "apiKey": "sk-your-api-key",
    "createdAt": "2026-01-28T10:00:00.000Z",
    "updatedAt": "2026-01-28T10:00:00.000Z"
  }
]
```

### Example

```bash
# List all LLM providers
curl http://localhost:3000/api/llm-providers

# List providers for a specific project
curl http://localhost:3000/api/llm-providers?projectId=123e4567-e89b-12d3-a456-426614174000
```

---

## GET /api/llm-providers/models

Get available models for each provider.

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

## GET /api/llm-providers/:id/models

Fetch available models dynamically from the provider's API. For OpenAI providers, this queries the `/v1/models` endpoint. For Anthropic, returns the default model list (no public models endpoint available).

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
| 404 | LLM provider not found |
| 500 | Failed to fetch models from provider API |

### Example

```bash
curl http://localhost:3000/api/llm-providers/987fcdeb-51a2-3bc4-d567-890123456789/models
```

---

## POST /api/llm-providers

Create a new LLM provider.

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `projectId` | string | Yes | Parent project ID |
| `name` | string | Yes | Provider name (unique within project) |
| `provider` | string | Yes | Provider type: "openai" or "anthropic" |
| `apiKey` | string | Yes | API key for the provider |

```json
{
  "projectId": "123e4567-e89b-12d3-a456-426614174000",
  "name": "Production OpenAI",
  "provider": "openai",
  "apiKey": "sk-your-api-key"
}
```

### Response (201 Created)

```json
{
  "id": "987fcdeb-51a2-3bc4-d567-890123456789",
  "projectId": "123e4567-e89b-12d3-a456-426614174000",
  "name": "Production OpenAI",
  "provider": "openai",
  "apiKey": "sk-your-api-key",
  "createdAt": "2026-01-28T10:00:00.000Z",
  "updatedAt": "2026-01-28T10:00:00.000Z"
}
```

### Errors

| Status | Description |
|--------|-------------|
| 400 | Missing required field (projectId, name, provider, or apiKey) |
| 404 | Project not found |
| 409 | LLM provider with name already exists in project |

### Example

```bash
curl -X POST http://localhost:3000/api/llm-providers \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "123e4567-e89b-12d3-a456-426614174000",
    "name": "Production OpenAI",
    "provider": "openai",
    "apiKey": "sk-your-api-key"
  }'
```

---

## GET /api/llm-providers/:id

Get an LLM provider by its ID.

### Response (200 OK)

```json
{
  "id": "987fcdeb-51a2-3bc4-d567-890123456789",
  "projectId": "123e4567-e89b-12d3-a456-426614174000",
  "name": "Production OpenAI",
  "provider": "openai",
  "apiKey": "sk-your-api-key",
  "createdAt": "2026-01-28T10:00:00.000Z",
  "updatedAt": "2026-01-28T10:00:00.000Z"
}
```

### Errors

| Status | Description |
|--------|-------------|
| 404 | LLM provider not found |

### Example

```bash
curl http://localhost:3000/api/llm-providers/987fcdeb-51a2-3bc4-d567-890123456789
```

---

## PUT /api/llm-providers/:id

Update an existing LLM provider.

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | No | New provider name |
| `provider` | string | No | New provider type |
| `apiKey` | string | No | New API key |

```json
{
  "name": "Updated Provider Name"
}
```

### Response (200 OK)

```json
{
  "id": "987fcdeb-51a2-3bc4-d567-890123456789",
  "projectId": "123e4567-e89b-12d3-a456-426614174000",
  "name": "Updated Provider Name",
  "provider": "openai",
  "apiKey": "sk-your-api-key",
  "createdAt": "2026-01-28T10:00:00.000Z",
  "updatedAt": "2026-01-28T10:30:00.000Z"
}
```

### Errors

| Status | Description |
|--------|-------------|
| 404 | LLM provider not found |
| 409 | LLM provider with name already exists in project |

### Example

```bash
curl -X PUT http://localhost:3000/api/llm-providers/987fcdeb-51a2-3bc4-d567-890123456789 \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated Provider Name"}'
```

---

## DELETE /api/llm-providers/:id

Delete an LLM provider.

### Response (204 No Content)

Empty response on success.

### Errors

| Status | Description |
|--------|-------------|
| 404 | LLM provider not found |

### Example

```bash
curl -X DELETE http://localhost:3000/api/llm-providers/987fcdeb-51a2-3bc4-d567-890123456789
```
