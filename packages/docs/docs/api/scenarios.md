---
sidebar_position: 4
---

# Scenarios API

REST endpoints for managing scenarios. Scenarios contain instructions that provide all the context needed for testing conversations. Scenarios can also include initial messages to seed conversations from a specific point.

## Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects/:projectId/scenarios` | List scenarios |
| POST | `/api/projects/:projectId/scenarios` | Create a scenario |
| GET | `/api/projects/:projectId/scenarios/:id` | Get a scenario by ID |
| PUT | `/api/projects/:projectId/scenarios/:id` | Update a scenario |
| DELETE | `/api/projects/:projectId/scenarios/:id` | Delete a scenario |

---

## GET /api/projects/:projectId/scenarios

List all scenarios.

### Response (200 OK)

```json
[
  {
    "id": "987fcdeb-51a2-3bc4-d567-890123456789",
    "name": "booking-cancellation",
    "instructions": "Customer wants to cancel a haircut appointment for tomorrow. They have a scheduling conflict. Booking was made 3 days ago with 24h cancellation policy.",
    "maxMessages": 10,
    "successCriteria": "Agent confirms cancellation",
    "failureCriteria": "Agent fails to process",
    "failureCriteriaMode": "on_max_messages",
    "createdAt": "2026-01-28T10:00:00.000Z",
    "updatedAt": "2026-01-28T10:00:00.000Z"
  }
]
```

### Example

```bash
curl http://localhost:3000/api/projects/PROJECT_ID/scenarios
```

---

## POST /api/projects/:projectId/scenarios

Create a new scenario.

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Scenario name |
| `instructions` | string | No | Instructions providing all context for the scenario |
| `messages` | array | No | Initial messages to seed the conversation |
| `maxMessages` | number | No | Maximum conversation turns |
| `successCriteria` | string | No | Natural language success criteria |
| `failureCriteria` | string | No | Natural language failure criteria |
| `failureCriteriaMode` | string | No | `"on_max_messages"` (default) or `"every_turn"` |
| `evaluators` | array | No | Custom evaluators (assertions and/or metrics) |
| `personaIds` | array | No | IDs of associated personas |

```json
{
  "name": "booking-cancellation",
  "instructions": "Customer wants to cancel a haircut appointment for tomorrow. They have a scheduling conflict. Booking was made 3 days ago with 24h cancellation policy.",
  "maxMessages": 10,
  "successCriteria": "Agent confirms cancellation",
  "failureCriteria": "Agent fails to process",
  "failureCriteriaMode": "on_max_messages",
  "messages": [
    { "role": "user", "content": "Hi, I need to cancel my appointment" },
    { "role": "assistant", "content": "I'd be happy to help. Can you provide your booking reference?" }
  ]
}
```

### Response (201 Created)

```json
{
  "id": "987fcdeb-51a2-3bc4-d567-890123456789",
  "name": "booking-cancellation",
  "instructions": "Customer wants to cancel a haircut appointment for tomorrow. They have a scheduling conflict. Booking was made 3 days ago with 24h cancellation policy.",
  "maxMessages": 10,
  "successCriteria": "Agent confirms cancellation",
  "failureCriteria": "Agent fails to process",
  "failureCriteriaMode": "on_max_messages",
  "createdAt": "2026-01-28T10:00:00.000Z",
  "updatedAt": "2026-01-28T10:00:00.000Z"
}
```

### Errors

| Status | Description |
|--------|-------------|
| 400 | Name is required |
| 409 | Scenario with name already exists |

### Example

```bash
curl -X POST http://localhost:3000/api/projects/PROJECT_ID/scenarios \
  -H "Content-Type: application/json" \
  -d '{
    "name": "booking-cancellation",
    "instructions": "Customer wants to cancel a haircut appointment for tomorrow. They have a scheduling conflict. Booking was made 3 days ago with 24h cancellation policy."
  }'
```

---

## GET /api/projects/:projectId/scenarios/:id

Get a scenario by its ID.

### Response (200 OK)

```json
{
  "id": "987fcdeb-51a2-3bc4-d567-890123456789",
  "name": "booking-cancellation",
  "instructions": "Customer wants to cancel a haircut appointment for tomorrow. They have a scheduling conflict. Booking was made 3 days ago with 24h cancellation policy.",
  "maxMessages": 10,
  "successCriteria": "Agent confirms cancellation",
  "failureCriteria": "Agent fails to process",
  "failureCriteriaMode": "on_max_messages",
  "createdAt": "2026-01-28T10:00:00.000Z",
  "updatedAt": "2026-01-28T10:00:00.000Z"
}
```

### Errors

| Status | Description |
|--------|-------------|
| 404 | Scenario not found |

### Example

```bash
curl http://localhost:3000/api/projects/PROJECT_ID/scenarios/987fcdeb-51a2-3bc4-d567-890123456789
```

---

## PUT /api/projects/:projectId/scenarios/:id

Update an existing scenario.

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | No | New scenario name |
| `instructions` | string | No | New instructions |
| `messages` | array | No | New initial messages |
| `maxMessages` | number | No | Maximum conversation turns |
| `successCriteria` | string | No | Natural language success criteria |
| `failureCriteria` | string | No | Natural language failure criteria |
| `failureCriteriaMode` | string | No | `"on_max_messages"` (default) or `"every_turn"` |
| `evaluators` | array | No | Custom evaluators (assertions and/or metrics) |
| `personaIds` | array | No | IDs of associated personas |

```json
{
  "instructions": "Customer wants to cancel appointment. VIP customer with flexible policy.",
  "maxMessages": 15,
  "messages": [
    { "role": "user", "content": "Hi, I need to cancel" }
  ]
}
```

### Response (200 OK)

```json
{
  "id": "987fcdeb-51a2-3bc4-d567-890123456789",
  "name": "booking-cancellation",
  "instructions": "Customer wants to cancel appointment. VIP customer with flexible policy.",
  "maxMessages": 15,
  "successCriteria": "Agent confirms cancellation",
  "failureCriteria": "Agent fails to process",
  "failureCriteriaMode": "on_max_messages",
  "createdAt": "2026-01-28T10:00:00.000Z",
  "updatedAt": "2026-01-28T10:30:00.000Z"
}
```

### Errors

| Status | Description |
|--------|-------------|
| 404 | Scenario not found |
| 409 | Scenario with name already exists |

### Example

```bash
curl -X PUT http://localhost:3000/api/projects/PROJECT_ID/scenarios/987fcdeb-51a2-3bc4-d567-890123456789 \
  -H "Content-Type: application/json" \
  -d '{"instructions": "Customer wants to cancel appointment. VIP customer with flexible policy."}'
```

---

## DELETE /api/projects/:projectId/scenarios/:id

Delete a scenario.

### Response (204 No Content)

Empty response on success.

### Errors

| Status | Description |
|--------|-------------|
| 404 | Scenario not found |

### Example

```bash
curl -X DELETE http://localhost:3000/api/projects/PROJECT_ID/scenarios/987fcdeb-51a2-3bc4-d567-890123456789
```
