---
sidebar_position: 3
---

# Personas API

REST endpoints for managing personas. Personas belong to a project and define a description and system prompt for test scenarios.

## Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/personas` | List personas |
| POST | `/api/personas` | Create a persona |
| GET | `/api/personas/:id` | Get a persona by ID |
| PUT | `/api/personas/:id` | Update a persona |
| DELETE | `/api/personas/:id` | Delete a persona |

---

## GET /api/personas

List personas, optionally filtered by project.

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
# List all personas
curl http://localhost:3000/api/personas

# List personas for a specific project
curl http://localhost:3000/api/personas?projectId=123e4567-e89b-12d3-a456-426614174000
```

---

## POST /api/personas

Create a new persona.

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `projectId` | string | Yes | Parent project ID |
| `name` | string | Yes | Persona name (unique within project) |
| `description` | string | No | Short description of the persona |
| `systemPrompt` | string | No | Full description / system prompt for this persona |

```json
{
  "projectId": "123e4567-e89b-12d3-a456-426614174000",
  "name": "impatient-user",
  "description": "A user who wants quick answers",
  "systemPrompt": "You are an impatient user who values brevity and expects quick, concise responses."
}
```

### Response (201 Created)

```json
{
  "id": "987fcdeb-51a2-3bc4-d567-890123456789",
  "projectId": "123e4567-e89b-12d3-a456-426614174000",
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
| 400 | Project ID or name is required |
| 404 | Project not found |
| 409 | Persona with name already exists in project |

### Example

```bash
curl -X POST http://localhost:3000/api/personas \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "123e4567-e89b-12d3-a456-426614174000",
    "name": "impatient-user",
    "description": "A user who wants quick answers",
    "systemPrompt": "You are an impatient user who values brevity and expects quick, concise responses."
  }'
```

---

## GET /api/personas/:id

Get a persona by its ID.

### Response (200 OK)

```json
{
  "id": "987fcdeb-51a2-3bc4-d567-890123456789",
  "projectId": "123e4567-e89b-12d3-a456-426614174000",
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
curl http://localhost:3000/api/personas/987fcdeb-51a2-3bc4-d567-890123456789
```

---

## PUT /api/personas/:id

Update an existing persona.

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | No | New persona name |
| `description` | string | No | New short description |
| `systemPrompt` | string | No | New system prompt |

```json
{
  "systemPrompt": "You are a technical user who expects detailed, accurate responses."
}
```

### Response (200 OK)

```json
{
  "id": "987fcdeb-51a2-3bc4-d567-890123456789",
  "projectId": "123e4567-e89b-12d3-a456-426614174000",
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
| 409 | Persona with name already exists in project |

### Example

```bash
curl -X PUT http://localhost:3000/api/personas/987fcdeb-51a2-3bc4-d567-890123456789 \
  -H "Content-Type: application/json" \
  -d '{"systemPrompt": "You are a technical user who expects detailed, accurate responses."}'
```

---

## DELETE /api/personas/:id

Delete a persona.

### Response (204 No Content)

Empty response on success.

### Errors

| Status | Description |
|--------|-------------|
| 404 | Persona not found |

### Example

```bash
curl -X DELETE http://localhost:3000/api/personas/987fcdeb-51a2-3bc4-d567-890123456789
```
