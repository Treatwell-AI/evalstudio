---
sidebar_position: 3
---

# Deployment

This guide covers deploying EvalStudio as a server with PostgreSQL storage.

## Server Project Setup

Create a standalone Node.js project for your EvalStudio server:

### 1. Create the project

```bash
mkdir my-evalstudio-server
cd my-evalstudio-server
npm init -y
```

### 2. Install dependencies

```bash
npm install @evalstudio/cli @evalstudio/postgres
```

### 3. Initialize the project

```bash
npx evalstudio init
```

This creates an `evalstudio.config.json` in the current directory.

### 4. Create a `.env` file

```bash
EVALSTUDIO_DATABASE_URL=postgresql://user:pass@localhost:5432/evalstudio
```

### 5. Configure PostgreSQL storage

Edit `evalstudio.config.json` to use Postgres:

```json
{
  "version": 3,
  "storage": {
    "type": "postgres",
    "connectionString": "${EVALSTUDIO_DATABASE_URL}"
  },
  "llmSettings": {
    "provider": "openai",
    "apiKey": "your-api-key",
    "models": {
      "evaluation": "gpt-4o",
      "persona": "gpt-4o-mini"
    }
  }
}
```

The `connectionString` supports `${VAR}` placeholders that resolve from environment variables at runtime. If `connectionString` is omitted entirely, it falls back to the `EVALSTUDIO_DATABASE_URL` environment variable.

### 6. Add scripts

Update your `package.json`:

```json
{
  "scripts": {
    "start": "evalstudio serve --port 3000",
    "db:init": "evalstudio db init",
    "db:status": "evalstudio db status"
  },
  "dependencies": {
    "@evalstudio/cli": "latest",
    "@evalstudio/postgres": "latest"
  }
}
```

### 7. Initialize the database

```bash
npm run db:init
```

### 8. Start the server

```bash
npm start
```

This serves both the API and Web UI on port 3000 (configurable with `--port` or the `EVALSTUDIO_PORT` env var).

## Folder structure

```
project
│-- evalstudio.config.json
│-- package-lock.json
│-- package.json
```

## Docker

Example `Dockerfile` for deploying an EvalStudio server with PostgreSQL:

```dockerfile
FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY evalstudio.config.json ./

# Initialize the database schema, then start the server
CMD npm run db:init && npm start
```

Build and run:

```bash
docker build -t evalstudio-server .
docker run -p 3000:3000 \
  -e EVALSTUDIO_DATABASE_URL="postgresql://user:pass@host:5432/evalstudio" \
  evalstudio-server
```

`db:init` is idempotent — it's safe to run on every container start. The schema is created if it doesn't exist and left untouched if it does.

## Environment Variables

| Variable                  | Description                                                |
| ------------------------- | ---------------------------------------------------------- |
| `EVALSTUDIO_DATABASE_URL` | PostgreSQL connection string (fallback when not in config) |
| `EVALSTUDIO_PORT`         | Server port (default: `3000`)                              |
| `EVALSTUDIO_PROJECT_DIR`  | Override project directory resolution                      |
