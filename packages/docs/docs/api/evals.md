---
sidebar_position: 5
---

# Evals API

REST API endpoints for managing evals. Evals can contain multiple scenarios to create comprehensive test collections. Personas are associated with scenarios, not with evals directly. When running an eval, runs are created for each scenario/persona combination.

## Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/evals` | List all evals |
| GET | `/api/evals/:id` | Get eval by ID |
| POST | `/api/evals` | Create a new eval |
| PUT | `/api/evals/:id` | Update an eval |
| DELETE | `/api/evals/:id` | Delete an eval |

## List Evals

```http
GET /api/evals
```

### Response

```json
[
  {
    "id": "987fcdeb-51a2-3bc4-d567-890123456789",
    "name": "Booking Cancellation Test",
    "connectorId": "connector-uuid",
    "input": [],
    "scenarioIds": ["scenario-uuid-1", "scenario-uuid-2"],
    "createdAt": "2026-01-28T10:00:00.000Z",
    "updatedAt": "2026-01-28T10:00:00.000Z"
  }
]
```

## Get Eval

```http
GET /api/evals/:id
GET /api/evals/:id?expand=true
```

### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `expand` | boolean | Include scenario details |

### Response (with expand=true)

```json
{
  "id": "987fcdeb-51a2-3bc4-d567-890123456789",
  "name": "Booking Cancellation Test",
  "connectorId": "connector-uuid",
  "input": [],
  "scenarioIds": ["scenario-uuid-1", "scenario-uuid-2"],
  "scenarios": [
    {
      "id": "scenario-uuid-1",
      "name": "Booking Cancellation",
      "instructions": "Customer needs to cancel",
      "maxMessages": 10,
      "successCriteria": "Agent confirms cancellation",
      "failureCriteria": "Agent fails to process"
    },
    {
      "id": "scenario-uuid-2",
      "name": "Booking Modification",
      "instructions": "Customer needs to change date",
      "maxMessages": 10
    }
  ],
  "connector": {
    "id": "connector-uuid",
    "name": "My Agent",
    "type": "langgraph",
    "baseUrl": "https://api.example.com"
  },
  "createdAt": "2026-01-28T10:00:00.000Z",
  "updatedAt": "2026-01-28T10:00:00.000Z"
}
```

### Error Response

```json
{
  "error": "Eval not found"
}
```

**Status Code:** 404

## Create Eval

```http
POST /api/evals
Content-Type: application/json
```

### Request Body

```json
{
  "name": "Booking Cancellation Test",
  "connectorId": "connector-uuid",
  "scenarioIds": ["scenario-uuid-1", "scenario-uuid-2"],
  "input": [{ "role": "user", "content": "I need to cancel" }]
}
```

Note: LLM provider for evaluation is configured at the project level via project `llmSettings`.

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Display name for the eval |
| `connectorId` | string | Yes | Connector for running this eval |
| `scenarioIds` | string[] | Yes | Array of scenario IDs (at least one required) |
| `input` | Message[] | No | Initial input messages (seed conversation) |

### Response

**Status Code:** 201 Created

```json
{
  "id": "987fcdeb-51a2-3bc4-d567-890123456789",
  "name": "Booking Cancellation Test",
  "connectorId": "connector-uuid",
  "input": [{ "role": "user", "content": "I need to cancel" }],
  "scenarioIds": ["scenario-uuid-1", "scenario-uuid-2"],
  "createdAt": "2026-01-28T10:00:00.000Z",
  "updatedAt": "2026-01-28T10:00:00.000Z"
}
```

### Error Responses

| Status | Description |
|--------|-------------|
| 400 | Name is required / Connector ID is required / At least one Scenario ID is required |
| 404 | Scenario/Connector not found |

## Update Eval

```http
PUT /api/evals/:id
Content-Type: application/json
```

### Request Body

```json
{
  "name": "Updated Eval Name",
  "scenarioIds": ["new-scenario-uuid-1", "new-scenario-uuid-2"]
}
```

All fields are optional. Only provided fields will be updated.

### Response

```json
{
  "id": "987fcdeb-51a2-3bc4-d567-890123456789",
  "name": "Updated Eval Name",
  "connectorId": "connector-uuid",
  "input": [],
  "scenarioIds": ["new-scenario-uuid-1", "new-scenario-uuid-2"],
  "createdAt": "2026-01-28T10:00:00.000Z",
  "updatedAt": "2026-01-28T10:30:00.000Z"
}
```

### Error Responses

| Status | Description |
|--------|-------------|
| 400 | scenarioIds cannot be empty |
| 404 | Eval/Scenario/Connector not found |

## Delete Eval

```http
DELETE /api/evals/:id
```

### Response

**Status Code:** 204 No Content

### Error Response

```json
{
  "error": "Eval not found"
}
```

**Status Code:** 404

## Scenarios and Run Creation

Evals can contain multiple scenarios, allowing you to create comprehensive test collections. When running an eval:

1. The system iterates through each scenario in `scenarioIds`
2. For each scenario, it uses the personas associated with that scenario
3. A run is created for each scenario/persona combination

For example, if an eval has 2 scenarios, and each scenario has 3 personas, creating runs for the eval produces 6 runs (2 x 3).

Personas are associated with scenarios, not with evals directly. This allows different scenarios to test different persona types.
