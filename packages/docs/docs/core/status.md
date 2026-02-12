---
sidebar_position: 1
---

# Status

Check the status of the EvalStudio core library, including version and environment information.

## Import

```typescript
import { getStatus, type Status } from "@evalstudio/core";
```

## Types

### Status

```typescript
interface Status {
  name: string;            // Package name ("evalstudio")
  version: string;         // Current version
  status: "ok" | "error";  // Library status
  timestamp: string;       // ISO 8601 timestamp
  node: string;            // Node.js version
}
```

## Functions

### getStatus()

Returns the current status of the library.

```typescript
function getStatus(): Status;
```

```typescript
const status = getStatus();
console.log(status);
// {
//   name: "evalstudio",
//   version: "0.0.1",
//   status: "ok",
//   timestamp: "2026-01-26T14:28:04.270Z",
//   node: "v20.19.6"
// }
```

## Use Cases

- **Health checks**: Verify the library is correctly imported
- **Logging**: Include version info in application logs
- **Diagnostics**: Debug environment issues
