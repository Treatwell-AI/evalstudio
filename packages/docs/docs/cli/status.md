---
sidebar_position: 1
---

# evalstudio status

Display the current status of your EvalStudio installation.

## Usage

```bash
evalstudio status [options]
```

## Options

| Option | Description |
|--------|-------------|
| `--json` | Output status as JSON (useful for scripts and CI/CD) |

## Examples

### Human-readable output

```bash
evalstudio status
```

Output:
```
EvalStudio Status
-----------------
Name:      evalstudio
Version:   0.0.1
Status:    ok
Node:      v20.19.6
Timestamp: 2026-01-26T14:28:03.290Z
```

### JSON output

```bash
evalstudio status --json
```

Output:
```json
{
  "name": "evalstudio",
  "version": "0.0.1",
  "status": "ok",
  "timestamp": "2026-01-26T14:28:04.270Z",
  "node": "v20.19.6"
}
```

## Use Cases

- **Health checks**: Verify EvalStudio is correctly installed
- **CI/CD pipelines**: Check status before running tests
- **Debugging**: Confirm Node.js version and installation state
