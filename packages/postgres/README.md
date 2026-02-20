# @evalstudio/postgres

PostgreSQL storage backend for [EvalStudio](https://github.com/Treatwell-AI/evalstudio). Replaces the default filesystem storage with PostgreSQL for team environments, production deployments, and horizontal scaling.

## Setting Up an EvalStudio Server

This guide walks through creating a standalone Node.js project that runs EvalStudio with PostgreSQL storage.

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

### 4. Configure PostgreSQL storage

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

### 5. Add a start script

Update your `package.json`:

```json
{
  "scripts": {
    "start": "evalstudio serve",
    "db:init": "evalstudio db init"
  },
  "dependencies": {
    "@evalstudio/cli": "latest",
    "@evalstudio/postgres": "latest"
  }
}
```

### 6. Initialize the database

```bash
export EVALSTUDIO_DATABASE_URL="postgresql://user:pass@localhost:5432/evalstudio"
npm run db:init
```

### 7. Start the server

```bash
npm start
```

This serves both the API and Web UI on port 3000 (configurable with `--port` or the `EVALSTUDIO_PORT` env var).

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

## How It Works

When `storage.type` is set to `"postgres"` in your config, `@evalstudio/core` dynamically imports `@evalstudio/postgres` at startup. No code changes are needed — just install the package and update the config.

If the package is not installed, you'll get a clear error message telling you to add it.

## API

### `createPostgresStorage(connectionString: string): Promise<StorageProvider>`

Creates a PostgreSQL-backed storage provider. The database schema must already exist (run `evalstudio db init` first). The connection is verified immediately so bad credentials fail at startup.

### `initSchema(connectionString: string): Promise<void>`

Creates all required database tables. Used internally by the `evalstudio db init` CLI command.

## License

MIT
