---
sidebar_position: 2
---

# Projects API

REST endpoints for managing projects.

## Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects` | List all projects |
| POST | `/api/projects` | Create a project |
| GET | `/api/projects/:id` | Get a project by ID |
| PUT | `/api/projects/:id` | Update a project |
| DELETE | `/api/projects/:id` | Delete a project |

---

## GET /api/projects

List all projects.

### Response (200 OK)

```json
[
  {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "my-product",
    "description": "Evaluations for my product",
    "createdAt": "2026-01-28T10:00:00.000Z",
    "updatedAt": "2026-01-28T10:00:00.000Z"
  }
]
```

### Example

```bash
curl http://localhost:3000/api/projects
```

---

## POST /api/projects

Create a new project.

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Project name (must be unique) |
| `description` | string | No | Project description |

```json
{
  "name": "my-product",
  "description": "Evaluations for my product"
}
```

### Response (201 Created)

```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "name": "my-product",
  "description": "Evaluations for my product",
  "createdAt": "2026-01-28T10:00:00.000Z",
  "updatedAt": "2026-01-28T10:00:00.000Z"
}
```

### Errors

| Status | Description |
|--------|-------------|
| 400 | Name is required |
| 409 | Project with name already exists |

### Example

```bash
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name": "my-product", "description": "Evaluations for my product"}'
```

---

## GET /api/projects/:id

Get a project by its ID.

### Response (200 OK)

```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "name": "my-product",
  "description": "Evaluations for my product",
  "createdAt": "2026-01-28T10:00:00.000Z",
  "updatedAt": "2026-01-28T10:00:00.000Z"
}
```

### Errors

| Status | Description |
|--------|-------------|
| 404 | Project not found |

### Example

```bash
curl http://localhost:3000/api/projects/123e4567-e89b-12d3-a456-426614174000
```

---

## PUT /api/projects/:id

Update an existing project.

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | No | New project name |
| `description` | string | No | New project description |

```json
{
  "description": "Updated description"
}
```

### Response (200 OK)

```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "name": "my-product",
  "description": "Updated description",
  "createdAt": "2026-01-28T10:00:00.000Z",
  "updatedAt": "2026-01-28T10:30:00.000Z"
}
```

### Errors

| Status | Description |
|--------|-------------|
| 404 | Project not found |
| 409 | Project with name already exists |

### Example

```bash
curl -X PUT http://localhost:3000/api/projects/123e4567-e89b-12d3-a456-426614174000 \
  -H "Content-Type: application/json" \
  -d '{"description": "Updated description"}'
```

---

## DELETE /api/projects/:id

Delete a project.

### Response (204 No Content)

Empty response on success.

### Errors

| Status | Description |
|--------|-------------|
| 404 | Project not found |

### Example

```bash
curl -X DELETE http://localhost:3000/api/projects/123e4567-e89b-12d3-a456-426614174000
```
