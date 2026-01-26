---
sidebar_position: 8
---

# evalstudio serve

Start the EvalStudio API server and web UI in a single process.

## Usage

```bash
evalstudio serve [options]
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `-p, --port <number>` | Port to listen on | `3000` (or `EVALSTUDIO_PORT` env var) |
| `--no-web` | Disable web UI (API only) | Web enabled |
| `--no-processor` | Disable background run processor | Processor enabled |
| `--open` | Open browser after starting | Disabled |

## Examples

### Start with defaults

```bash
evalstudio serve
```

Output:
```
  EvalStudio server started
  API:  http://127.0.0.1:3000/api
  Web:  http://127.0.0.1:3000
  Run processor: enabled
```

### Custom port

```bash
evalstudio serve --port 8080
```

Or using the environment variable:

```bash
EVALSTUDIO_PORT=8080 evalstudio serve
```

### API only (no web UI)

```bash
evalstudio serve --no-web
```

### Open browser automatically

```bash
evalstudio serve --open
```

### Via npx (no global install)

```bash
npx evalstudio serve
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `EVALSTUDIO_PORT` | Default port for the server (overridden by `--port` flag) |

## Architecture

The serve command starts a single Fastify server that:

1. **API routes** — All REST endpoints served under `/api` prefix
2. **Web UI** — Built React app served as static files with SPA fallback
3. **Run processor** — Background service that polls and executes queued runs

The web UI assets are embedded in the CLI package at build time, so no separate web server is needed.
