---
sidebar_position: 2
---

# Projects API

REST endpoints for managing projects and workspace configuration. A workspace contains multiple projects, each with isolated data and optional configuration overrides.

## Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects` | List all projects |
| POST | `/api/projects` | Create a new project |
| GET | `/api/workspace` | Get workspace configuration |
| PUT | `/api/workspace` | Update workspace defaults |
| GET | `/api/projects/:projectId/config` | Get effective project config |
| PUT | `/api/projects/:projectId/config` | Update project config |
| DELETE | `/api/projects/:projectId` | Delete a project |

All entity endpoints (personas, scenarios, evals, runs, connectors) are scoped under `/api/projects/:projectId/`. See individual entity docs for details.

---

## GET /api/projects

List all projects in the workspace.

### Response (200 OK)

```json
[
  {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "name": "my-product-evals"
  },
  {
    "id": "f9e8d7c6-b5a4-3210-fedc-ba0987654321",
    "name": "staging-tests"
  }
]
```

### Example

```bash
curl http://localhost:3000/api/projects
```

---

## POST /api/projects

Create a new project in the workspace.

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Project name |

```json
{
  "name": "my-product-evals"
}
```

### Response (201 Created)

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "name": "my-product-evals"
}
```

### Example

```bash
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name": "my-product-evals"}'
```

---

## GET /api/workspace

Get the workspace-level configuration (defaults inherited by all projects).

:::note
API keys are redacted in all config responses. The `apiKey` field contains a masked value (e.g., `"sk-1...cdef"`) instead of the actual key.
:::

### Response (200 OK)

```json
{
  "version": 3,
  "name": "~/evalstudio",
  "projects": [
    { "id": "a1b2c3d4-...", "name": "my-product-evals" }
  ],
  "llmSettings": {
    "provider": "openai",
    "apiKey": "sk-1...cdef",
    "models": { "evaluation": "gpt-4o" }
  },
  "maxConcurrency": 5
}
```

---

## PUT /api/workspace

Update workspace-level defaults. These are inherited by projects that don't override them.

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | No | Workspace name |
| `llmSettings` | object \| null | No | Default LLM config (null to remove) |
| `maxConcurrency` | number \| null | No | Default max concurrent runs (null to clear) |

When updating `llmSettings`, the `apiKey` field is optional. Omit it to keep the existing stored key — only provide it when setting a new key.

### Response (200 OK)

Returns the updated workspace config (with redacted API key).

---

## GET /api/projects/:projectId/config

Get the effective configuration for a specific project (workspace defaults merged with project overrides).

### Response (200 OK)

```json
{
  "version": 3,
  "name": "my-product-evals",
  "llmSettings": {
    "provider": "openai",
    "apiKey": "sk-1...cdef",
    "models": { "evaluation": "gpt-4o" }
  },
  "maxConcurrency": 5
}
```

### Example

```bash
curl http://localhost:3000/api/projects/a1b2c3d4/config
```

---

## PUT /api/projects/:projectId/config

Update project-specific configuration. Fields set to `null` are cleared (inheriting workspace defaults).

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | No | Project name |
| `llmSettings` | object \| null | No | LLM config (null to inherit from workspace) |
| `maxConcurrency` | number \| null | No | Max concurrent runs (null to inherit) |

When updating `llmSettings`, the `apiKey` field is optional. Omit it to keep the existing stored key — only provide it when setting a new key.

### Response (200 OK)

Returns the effective (merged) config after update (with redacted API key).

---

## DELETE /api/projects/:projectId

Delete a project and all its data.

### Response (204 No Content)

Empty response on success.

### Example

```bash
curl -X DELETE http://localhost:3000/api/projects/a1b2c3d4
```

---

## Project Images

Generic blob store for project images (persona portraits, style references, etc.).

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects/:projectId/images` | List images by role |
| POST | `/api/projects/:projectId/images` | Upload an image |
| GET | `/api/projects/:projectId/images/:id` | Serve an image |
| DELETE | `/api/projects/:projectId/images/:id` | Delete an image |

### GET /api/projects/:projectId/images

List image IDs filtered by role.

**Query Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `role` | string | Yes | Image role to filter by (e.g., `persona-avatar-styleguide`) |

**Response (200 OK):**

```json
{ "ids": ["img1.png", "img2.png"] }
```

### POST /api/projects/:projectId/images

Upload an image. Returns a generated image ID.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `imageBase64` | string | Yes | Base64-encoded image data |
| `role` | string | Yes | Image role (e.g., `persona-avatar`, `persona-avatar-styleguide`, `upload`) |
| `filename` | string | No | Original filename (for mime type detection) |

**Response (201 Created):**

```json
{ "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890.png" }
```

### GET /api/projects/:projectId/images/:id

Serve an image with appropriate `Content-Type` header and caching.

### DELETE /api/projects/:projectId/images/:id

Delete an image. Returns 204 on success, 404 if not found.

---

## Project-Scoped Entity Routes

All entity endpoints are nested under a project:

```
/api/projects/:projectId/images
/api/projects/:projectId/personas
/api/projects/:projectId/scenarios
/api/projects/:projectId/evals
/api/projects/:projectId/runs
/api/projects/:projectId/connectors
```

The project ID can be the full UUID or a unique prefix (first 8+ characters).
