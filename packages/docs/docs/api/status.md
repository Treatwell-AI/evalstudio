---
sidebar_position: 1
---

# Status API

REST endpoint for checking the API server status.

## Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/status` | Get server status |

---

## GET /api/status

Returns the current status of the EvalStudio API server.

### Response (200 OK)

```json
{
  "name": "evalstudio",
  "version": "0.0.1",
  "status": "ok",
  "timestamp": "2026-01-26T14:28:04.270Z",
  "node": "v20.19.6"
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Package name (`"evalstudio"`) |
| `version` | string | Current version |
| `status` | string | Server status (`"ok"` or `"error"`) |
| `timestamp` | string | ISO 8601 timestamp |
| `node` | string | Node.js version running the server |

### Example

```bash
curl http://localhost:3000/api/status
```

## Use Cases

- **Health checks**: Load balancer or Kubernetes readiness probes
- **Monitoring**: Track API server uptime
- **Debugging**: Verify server is running and responding
