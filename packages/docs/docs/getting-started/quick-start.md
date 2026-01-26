---
sidebar_position: 2
---

# Quick Start

Get up and running with EvalStudio in minutes.

## 1. Initialize a Project

```bash
evalstudio init my-evals
cd my-evals
```

This creates a `my-evals/` directory containing:
- `evalstudio.config.json` — project marker (commit to git)
- `.evalstudio/` — data directory (auto-added to `.gitignore`)

## 2. Create a Project

```bash
evalstudio project create --name "My Project"
```

## 3. Verify Setup

```bash
evalstudio status
```

You should see output showing the local storage directory.

## 4. Create Scenarios and Evals

```bash
evalstudio scenario create --name "Greeting" --project "My Project"
evalstudio eval create --name "Greeting Test" --scenario "Greeting" --connector "My Connector" --project "My Project"
```

## Start the Server

Launch the API server and web UI:

```bash
evalstudio serve
```

This starts the server at `http://localhost:3000` with the API at `/api` and the web dashboard at the root. Use `--open` to auto-open the browser:

```bash
evalstudio serve --open
```

## Global Storage

If you run commands outside of an initialized project directory, EvalStudio uses global storage at `~/.evalstudio/`. You can override this with the `EVALSTUDIO_STORAGE_DIR` environment variable.
