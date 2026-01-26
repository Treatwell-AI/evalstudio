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

### Storage Directory

EvalStudio resolves the storage directory in this order:

1. `setStorageDir()` — programmatic override (for tests or embedding)
2. `EVALSTUDIO_STORAGE_DIR` — environment variable
3. **Local project** — walks up from `cwd` looking for `evalstudio.config.json`, uses `.evalstudio/` next to it
4. `~/.evalstudio/` — global default

To create a local project directory:

```bash
evalstudio init my-evals
cd my-evals
```

To override with an environment variable:

```bash
export EVALSTUDIO_STORAGE_DIR=/path/to/storage
evalstudio status
```

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
