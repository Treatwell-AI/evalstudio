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
- `evalstudio.config.json` -- project configuration (commit to git)
- `data/` -- data directory for entities (auto-added to `.gitignore`)

## 2. Verify Setup

```bash
evalstudio status
```

You should see output showing the project directory.

## 3. Create Scenarios and Evals

```bash
evalstudio scenario create --name "Greeting"
evalstudio eval create --name "Greeting Test" --scenario "Greeting" --connector "My Connector"
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

## Project Directory Override

You can override the project directory with the `EVALSTUDIO_PROJECT_DIR` environment variable:

```bash
export EVALSTUDIO_PROJECT_DIR=/path/to/project
evalstudio status
```
