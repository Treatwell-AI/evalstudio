# `evalstudio serve` Command

## Problem

Running the full stack requires being in the monorepo root:

```bash
pnpm --filter @evalstudio/api start   # API on :3000
pnpm --filter @evalstudio/web dev     # Web on :5173 (proxies to API)
```

This doesn't work once the CLI is installed globally via npm. Users can't run the UI from an arbitrary project directory.

## Proposal

A single CLI command that starts the API server and serves the built web UI — from any directory.

```bash
evalstudio serve                    # Start API + Web UI on port 3000
evalstudio serve --port 8080        # Custom port
evalstudio serve --no-web           # API only (headless mode)
evalstudio serve --no-processor     # Don't auto-start the RunProcessor
evalstudio serve --open             # Open browser after starting
```

Works via global install or npx:

```bash
npm install -g evalstudio && evalstudio serve
npx evalstudio serve
```

One process, one port. The API handles `/api/*` routes as JSON endpoints, and serves the web UI's static files for everything else (with SPA fallback to `index.html`).

## Approach: Embed Web UI in CLI Package

The built web UI (static files) ships inside the `evalstudio` CLI package. One install gets you everything.

```bash
npm install -g evalstudio
evalstudio serve
# ✓ API server on http://localhost:3000
# ✓ Web UI on http://localhost:3000
# ✓ Run processor started
```

### Package sizes

| Package | dist/ size | Runtime deps |
|---------|-----------|--------------|
| Core | 376 KB | none |
| CLI | 272 KB | commander |
| API | 160 KB | fastify |
| Web dist | 720 KB | none (pure static files) |
| **Total** | **~1.5 MB** | **commander, fastify** |

The web build output is JS + CSS compiled by Vite. Once built, it has zero Node.js dependencies — it's a React SPA compiled to static assets. No React, no Vite, no TanStack at runtime — all compiled away.

### How it ships

The CLI package includes the web dist as a static directory:

```
packages/cli/
  dist/
    index.js          ← CLI entry point
    commands/
    ...
  web-dist/           ← copied from packages/web/dist at build time
    index.html
    assets/
      index-abc.js
      index-def.css
```

The `serve` command resolves the path relative to its own `__dirname`:

```typescript
const webDistPath = path.join(__dirname, '..', 'web-dist');
```

This works regardless of how the package is installed — globally, locally, or via `npx` — because `__dirname` always resolves to the actual filesystem path of the running script, and the `web-dist/` directory ships alongside it.

The CLI's `package.json` includes this in `files`:

```json
{
  "files": ["dist", "web-dist"]
}
```

## API URL Resolution

The web app hardcodes `const API_BASE = "/api"` in `packages/web/src/lib/api.ts`, and the Vite dev proxy rewrites `/api/*` → `localhost:3000/*`.

For `evalstudio serve` to work (same host, same port), the API server needs to mount its routes under `/api/` instead of `/`:

```
GET /api/projects        → API (JSON)
GET /api/runs            → API (JSON)
GET /                    → Web UI (index.html)
GET /evals/123           → Web UI (SPA fallback → index.html)
GET /assets/index-abc.js → Web UI (static file)
```

This means:

- **No changes to the web app** — it already uses `/api` as base
- **Small change to the API** — prefix all routes with `/api`
- **Dev mode still works** — Vite proxy continues to rewrite `/api/*` → `localhost:3000/*`

## Implementation Plan

### 1. Prefix API routes with `/api`

In `packages/api/src/index.ts`, register all routes under an `/api` prefix. The web app already sends requests to `/api/*` so this aligns both sides.

### 2. Add static file serving to the API

Add `@fastify/static` to `@evalstudio/api` and a new option in `createServer()`:

```typescript
interface ServerOptions {
  // ...existing options...
  webDistPath?: string;  // Path to built web UI files
}
```

When `webDistPath` is set:

- Serve static files from that directory
- SPA fallback: non-API routes return `index.html` for client-side routing

### 3. Add `serve` command to CLI

New file: `packages/cli/src/commands/serve.ts`

```typescript
program
  .command('serve')
  .description('Start the EvalStudio API server and web UI')
  .option('-p, --port <number>', 'Port to listen on', '3000')
  .option('--no-web', 'Disable web UI (API only)')
  .option('--no-processor', 'Disable background run processor')
  .option('--open', 'Open browser after starting')
  .action(async (options) => {
    const { createServer } = await import('@evalstudio/api');
    const webDistPath = options.web
      ? path.join(__dirname, '..', 'web-dist')
      : undefined;
    const server = await createServer({
      logger: true,
      runProcessor: options.processor,
      webDistPath,
    });
    await server.listen({ port: parseInt(options.port), host: '0.0.0.0' });
  });
```

### 4. Add build step to copy web dist into CLI

In `turbo.json` or a build script, copy `packages/web/dist/` → `packages/cli/web-dist/` after the web build completes. This ensures the CLI package always ships with the latest web UI.

```json
// turbo.json - cli build depends on web build
{
  "tasks": {
    "@evalstudio/cli#build": {
      "dependsOn": ["@evalstudio/web#build", "^build"]
    }
  }
}
```

A simple postbuild script in the CLI package handles the copy:

```json
{
  "scripts": {
    "build": "tsc",
    "postbuild": "cp -r ../web/dist web-dist"
  }
}
```

### 5. Update dependency graph

```
evalstudio (core)
    ↑
    ├── @evalstudio/api          ← adds @fastify/static
    │
    └── @evalstudio/cli          ← adds dependency on @evalstudio/api
                                    ships web-dist/ (static files from @evalstudio/web)
```

### 6. Update CLI `package.json`

```json
{
  "name": "evalstudio",
  "files": ["dist", "web-dist"],
  "dependencies": {
    "evalstudio": "workspace:*",
    "@evalstudio/api": "workspace:*",
    "commander": "^13.1.0"
  }
}
```

## Alternative Considered: Separate `@evalstudio/web` Package

Publish `@evalstudio/web` as a separate npm package containing only built static files, discovered at runtime via `require.resolve`. Users would install it separately: `npm install -g evalstudio @evalstudio/web`.

| | Embed in CLI (chosen) | Separate package |
|---|---|---|
| `npm i -g evalstudio` size | +720 KB (web dist) | No change |
| "Just works" out of box | Yes, UI always there | Requires second install |
| CI / headless environments | 720 KB unused payload | Installs only what's needed |
| Update web UI independently | Coupled to CLI release | Independent releases |
| Version sync | Always matched | Can drift (CLI v0.3 + Web v0.1) |
| Complexity | Simple copy at build time | Runtime discovery + version checks + user confusion |

### Why embed wins

1. **The total install is tiny.** ~1.5 MB of dist files plus commander and fastify. Adding 720 KB of static assets is a rounding error.
2. **"Just works" matters most at v0.1.** `npm install -g evalstudio && evalstudio serve` or `npx evalstudio serve` gives you the full experience. No second package to discover, no "where's the UI?" confusion.
3. **720 KB is negligible for CI.** Headless environments downloading an extra 720 KB of static files is a non-issue — it's smaller than most single npm packages.
4. **Independent release cycles are premature.** At v0.1, the web UI and CLI are tightly coupled and evolving together. Decoupling them adds coordination overhead for zero practical benefit.
5. **No version sync problem.** With separate packages, CLI v0.3 could serve Web v0.1 — the UI would hit missing endpoints or lack new features. You'd need version compatibility checks and clear error messages for mismatches. Embedding guarantees the web UI always matches the API it's served from.
6. **Less code, fewer failure modes.** No `require.resolve` discovery, no "install @evalstudio/web for the dashboard" messaging, no version compatibility matrix between packages.
