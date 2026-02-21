---
sidebar_position: 3
---

# Personas API

REST endpoints for managing personas. Personas define a description and system prompt for test scenarios.

## Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects/:projectId/personas` | List personas |
| POST | `/api/projects/:projectId/personas` | Create a persona |
| GET | `/api/projects/:projectId/personas/:id` | Get a persona by ID |
| PUT | `/api/projects/:projectId/personas/:id` | Update a persona |
| DELETE | `/api/projects/:projectId/personas/:id` | Delete a persona |
| POST | `/api/projects/:projectId/personas/:id/generate-image` | Generate AI portrait |

---

## GET /api/projects/:projectId/personas

List all personas.

### Response (200 OK)

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

### Example

```bash
curl http://localhost:3000/api/projects/PROJECT_ID/personas
```

---

## POST /api/projects/:projectId/personas

Create a new persona.

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Persona name |
| `description` | string | No | Short description of the persona |
| `systemPrompt` | string | No | Full description / system prompt for this persona |
| `headers` | object | No | HTTP headers merged with connector headers (persona headers take precedence) |

```json
{
  "name": "impatient-user",
  "description": "A user who wants quick answers",
  "systemPrompt": "You are an impatient user who values brevity and expects quick, concise responses.",
  "headers": { "X-User-Language": "en" }
}
```

### Response (201 Created)

```json
{
  "id": "987fcdeb-51a2-3bc4-d567-890123456789",
  "name": "impatient-user",
  "description": "A user who wants quick answers",
  "systemPrompt": "You are an impatient user who values brevity and expects quick, concise responses.",
  "createdAt": "2026-01-28T10:00:00.000Z",
  "updatedAt": "2026-01-28T10:00:00.000Z"
}
```

### Errors

| Status | Description |
|--------|-------------|
| 400 | Name is required |
| 409 | Persona with name already exists |

### Example

```bash
curl -X POST http://localhost:3000/api/projects/PROJECT_ID/personas \
  -H "Content-Type: application/json" \
  -d '{
    "name": "impatient-user",
    "description": "A user who wants quick answers",
    "systemPrompt": "You are an impatient user who values brevity and expects quick, concise responses."
  }'
```

---

## GET /api/projects/:projectId/personas/:id

Get a persona by its ID.

### Response (200 OK)

```json
{
  "id": "987fcdeb-51a2-3bc4-d567-890123456789",
  "name": "impatient-user",
  "description": "A user who wants quick answers",
  "systemPrompt": "You are an impatient user who values brevity and expects quick, concise responses.",
  "createdAt": "2026-01-28T10:00:00.000Z",
  "updatedAt": "2026-01-28T10:00:00.000Z"
}
```

### Errors

| Status | Description |
|--------|-------------|
| 404 | Persona not found |

### Example

```bash
curl http://localhost:3000/api/projects/PROJECT_ID/personas/987fcdeb-51a2-3bc4-d567-890123456789
```

---

## PUT /api/projects/:projectId/personas/:id

Update an existing persona.

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | No | New persona name |
| `description` | string | No | New short description |
| `systemPrompt` | string | No | New system prompt |
| `imageUrl` | string | No | Image ID referencing a stored image |
| `headers` | object | No | HTTP headers merged with connector headers (persona headers take precedence) |

```json
{
  "systemPrompt": "You are a technical user who expects detailed, accurate responses."
}
```

### Response (200 OK)

```json
{
  "id": "987fcdeb-51a2-3bc4-d567-890123456789",
  "name": "impatient-user",
  "description": "A user who wants quick answers",
  "systemPrompt": "You are a technical user who expects detailed, accurate responses.",
  "createdAt": "2026-01-28T10:00:00.000Z",
  "updatedAt": "2026-01-28T10:30:00.000Z"
}
```

### Errors

| Status | Description |
|--------|-------------|
| 404 | Persona not found |
| 409 | Persona with name already exists |

### Example

```bash
curl -X PUT http://localhost:3000/api/projects/PROJECT_ID/personas/987fcdeb-51a2-3bc4-d567-890123456789 \
  -H "Content-Type: application/json" \
  -d '{"systemPrompt": "You are a technical user who expects detailed, accurate responses."}'
```

---

## DELETE /api/projects/:projectId/personas/:id

Delete a persona.

### Response (204 No Content)

Empty response on success.

### Errors

| Status | Description |
|--------|-------------|
| 404 | Persona not found |

### Example

```bash
curl -X DELETE http://localhost:3000/api/projects/PROJECT_ID/personas/987fcdeb-51a2-3bc4-d567-890123456789
```

---

## POST /api/projects/:projectId/personas/:id/generate-image

Generate an AI portrait image for a persona using OpenAI's `gpt-image-1` model. The image is generated from the persona's `systemPrompt` and optionally styled to match the project's style reference images.

Requires an OpenAI LLM provider configured in project settings.

### Response (200 OK)

Returns the updated persona with `imageUrl` set to the generated image ID.

```json
{
  "id": "987fcdeb-51a2-3bc4-d567-890123456789",
  "name": "impatient-user",
  "description": "A user who wants quick answers",
  "systemPrompt": "You are an impatient user who values brevity...",
  "imageUrl": "a1b2c3d4-e5f6-7890-abcd-ef1234567890.png",
  "createdAt": "2026-01-28T10:00:00.000Z",
  "updatedAt": "2026-01-28T10:30:00.000Z"
}
```

### Errors

| Status | Description |
|--------|-------------|
| 400 | Persona has no system prompt |
| 400 | No LLM provider configured |
| 400 | LLM provider is not OpenAI |
| 404 | Persona not found |

### Example

```bash
curl -X POST http://localhost:3000/api/projects/PROJECT_ID/personas/987fcdeb/generate-image
```
