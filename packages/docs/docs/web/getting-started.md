---
sidebar_position: 1
---

# Web Dashboard

The `@evalstudio/web` package provides a web-based dashboard as an alternative to the CLI and API for managing EvalStudio.

## Prerequisites

The web dashboard requires the API server to be running:

```bash
pnpm --filter @evalstudio/api start
```

This starts the API at http://localhost:3000.

## Running the Dashboard

Start the development server:

```bash
pnpm --filter @evalstudio/web dev
```

Open http://localhost:5173 in your browser.

## Features

### Project Management

The dashboard provides a complete UI for managing projects:

- **View projects**: See all projects in a card layout
- **Create project**: Click "+ New Project" to add a new project
- **Edit project**: Click "Edit" on any project card
- **Delete project**: Click "Delete" to remove a project

### Status Bar

The header displays the current API connection status:

- **Green**: API is connected and responding
- **Red**: API is offline or unreachable

## Building for Production

Build the static files:

```bash
pnpm --filter @evalstudio/web build
```

The output is in `packages/web/dist/`. You can serve these files with any static file server.

Preview the production build:

```bash
pnpm --filter @evalstudio/web preview
```

## Configuration

### API Proxy

In development, the Vite dev server proxies `/api` requests to `http://localhost:3000`. This is configured in `vite.config.ts`:

```typescript
server: {
  proxy: {
    "/api": {
      target: "http://localhost:3000",
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api/, ""),
    },
  },
},
```

For production, configure your web server or reverse proxy to route `/api` to the API server.

## Tech Stack

- **Vite** - Fast development server and build tool
- **React 18** - UI library
- **TanStack Query** - Data fetching and caching
- **TypeScript** - Type safety
