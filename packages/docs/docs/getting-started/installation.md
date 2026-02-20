---
sidebar_position: 1
---

# Installation

## Prerequisites

- Node.js 20 or higher
- pnpm (recommended) or npm

## Install from npm

```bash
# Install the CLI globally
npm install -g @evalstudio/cli

# Or use npx
npx @evalstudio/cli status
```

## Install for Development

Clone the repository and install dependencies:

```bash
git clone https://github.com/evalstudio/evalstudio.git
cd evalstudio
pnpm install
pnpm build
```

## Configuration

### Project Directory

EvalStudio uses a single-project model: one directory = one project. A project is defined by the presence of an `evalstudio.config.json` file, with data stored in a `data/` subdirectory.

EvalStudio resolves the project directory in this order:

1. `setProjectDir()` -- programmatic override (for tests or embedding)
2. `EVALSTUDIO_PROJECT_DIR` -- environment variable
3. **Local project** -- walks up from `cwd` looking for `evalstudio.config.json`, uses `data/` next to it

To create a new project directory:

```bash
evalstudio init my-evals
cd my-evals
```

To override with an environment variable:

```bash
export EVALSTUDIO_PROJECT_DIR=/path/to/project
evalstudio status
```

## PostgreSQL Storage (Optional)

By default, EvalStudio stores data as JSON files on disk. For team environments or production use, you can use PostgreSQL instead.

```bash
# Install the PostgreSQL storage package
npm install @evalstudio/postgres
```

Add storage configuration to your `evalstudio.config.json`:

```json
{
  "storage": {
    "type": "postgres",
    "connectionString": "postgresql://user:pass@localhost:5432/evalstudio"
  }
}
```

Then initialize the database schema:

```bash
evalstudio db init
```

See the [Projects documentation](../core/projects#storage-configuration) for details on connection string resolution and environment variable support.

## Verify Installation

Check that everything is working:

```bash
evalstudio status
```

You should see output like:

```
EvalStudio Status
-----------------
Name:      evalstudio
Version:   0.0.1
Status:    ok
Node:      v20.x.x
Timestamp: 2026-01-26T12:00:00.000Z
```
