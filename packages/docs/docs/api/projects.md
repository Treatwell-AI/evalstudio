---
sidebar_position: 2
---

# Project API

REST endpoints for reading and updating the current project configuration. A project is defined by an `evalstudio.config.json` file in a directory — there is no multi-project management.

## Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/project` | Get current project configuration |
| PUT | `/api/project` | Update project configuration |

---

## GET /api/project

Get the current project configuration.

### Response (200 OK)

```json
{
  "name": "my-product-evals",
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

### Example

```bash
curl http://localhost:3000/api/project
```

---

## PUT /api/project

Update the project configuration.

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | No | Project name |
| `llmSettings` | object \| null | No | LLM configuration (null to clear) |

```json
{
  "name": "updated-project-name",
  "llmSettings": {
    "evaluation": {
      "providerId": "provider-uuid",
      "model": "gpt-4o"
    }
  }
}
```

### Response (200 OK)

```json
{
  "name": "updated-project-name",
  "llmSettings": {
    "evaluation": {
      "providerId": "provider-uuid",
      "model": "gpt-4o"
    }
  }
}
```

### Example

```bash
curl -X PUT http://localhost:3000/api/project \
  -H "Content-Type: application/json" \
  -d '{"name": "updated-project-name"}'
```
