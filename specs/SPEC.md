# EvalStudio - Specification Document

**Version:** 3.0
**Date:** 2026-02-26
**Status:** Current

---

## Design Principles

- **Three Interfaces**: CLI, Web UI, and REST API - all equal first-class citizens
- **Shared Core Engine**: All interfaces use the same evaluation engine and business logic
- **CI-Ready**: CLI designed for automated testing in CI/CD pipelines with `--json` output
- **API Integration**: REST API for programmatic access and custom integrations
- **Decoupled Architecture**: Core engine, API server, and Web UI are independent modules
- **Flexible Storage**: Filesystem (git-friendly JSON) or PostgreSQL (team collaboration)

---

## 1. Product Requirements

### 1.1 Core Features

#### Eval Management

- **Multiple Creation Methods**:
  - CLI: Command-line eval creation with flags, or direct JSON file editing
  - Web UI: Form-based eval creation and management
  - API: Programmatic eval creation via REST endpoints
- **Flexible Storage**:
  - Filesystem: JSON files in `projects/{id}/data/` directory (git-friendly)
  - PostgreSQL: Optional backend via `@evalstudio/postgres` for team collaboration
  - All interfaces use the same storage backend
- **Version Control**: Git-friendly JSON format for filesystem storage

#### Message Format

EvalStudio uses a message-based format for conversations:

- Input: Array of messages (`[{role, content}]`)
- Output: Message response from the agent
- Use for: Chatbots, conversational AI, multi-turn dialogues
- Evaluation: Applied to message content

```typescript
{
  "input": {
    "messages": [
      { "role": "user", "content": "Hello" }
    ]
  }
}
```

#### Connectors

- **Strategy Pattern**: Connector strategies implement a common interface for invoking target systems
- **Built-in Connectors**:
  - LangGraph Dev API connector for langgraph-backed agents
- **Configuration**: Store endpoint URLs, headers, and connector-specific settings (e.g., assistantId)

#### Evaluation Execution

- **Run Processing**: Background processor polls for queued runs and executes them
- **Concurrent Execution**: Configurable concurrency via `--concurrency` flag (default: 3)
- **CLI Output**: Formatted terminal output with colored status indicators and `--json` for machine-readable output
- **Manual Retry**: Failed runs (status: "error") can be retried

#### Evaluation Methods

- **LLM-as-Judge (Criteria)**:
  - Configurable LLM provider (OpenAI, Anthropic)
  - Natural language success/failure criteria defined per scenario
  - Pass/fail evaluation with confidence score and reasoning
- **Custom Evaluators**:
  - Pluggable evaluator definitions via `EvaluatorRegistry`
  - Two kinds: assertions (pass/fail gates) and metrics (measurements only)
  - Built-in metrics: `tool-call-count`, `token-usage`
  - Auto evaluators run on every scenario automatically

#### Results & Reporting

- **CLI Output**: Formatted terminal output with pass/fail summary, `--json` flag for automation
- **Storage**: Results saved alongside eval data (filesystem or PostgreSQL)
- **Web Dashboard**: Browse runs, view conversation transcripts, evaluator results
- **Metrics**:
  - Pass/fail rates
  - Response latency
  - Token usage (from connector metadata)
  - Custom evaluator metrics

### 1.2 Glossary & User Stories

> **Note:** Glossary and User Stories have been moved to [USER-STORIES.md](USER-STORIES.md)

### 1.3 User Workflows

#### CLI Workflow (Developer/CI)

1. Install: `npm install -g @evalstudio/cli` or use `npx @evalstudio/cli`
2. Initialize: `evalstudio init` (creates workspace config and first project)
3. Configure: `evalstudio llm-provider set --provider openai --api-key sk-...`
4. Create entities: `evalstudio connector create`, `evalstudio persona create`, `evalstudio scenario create`
5. Create and run eval: `evalstudio eval create`, `evalstudio run create -e <eval>`, `evalstudio run process`
6. CI Integration: All commands support `--json` for machine-readable output

#### Web UI Workflow (QA/PM)

1. Start server: `evalstudio serve` (or `evalstudio serve --open` to auto-open browser)
2. Navigate to Web UI at http://localhost:3000
3. Create connectors, personas, and scenarios via forms
4. Create eval combining scenarios with a connector
5. Run evaluation from UI
6. View results in dashboard with conversation transcripts and metrics

#### API Workflow (Developer)

1. Start API server: `evalstudio serve` (or `evalstudio serve --no-web` for API only)
2. Make API calls to create/manage entities under `/api` prefix
3. Trigger evaluation runs via POST request
4. Poll for run status and results

### 1.4 Web UI Structure

**Left Sidebar Navigation:**

```
├── Dashboard
├── Evals
├── ─────────────
├── Scenarios
├── Personas
├── Settings
│   ├── General
│   ├── Connectors
│   └── LLM Providers
```

| Section         | Description                                                        |
| --------------- | ------------------------------------------------------------------ |
| **Dashboard**   | Overview metrics, recent evals, run list                           |
| **Evals**       | Create, run, and view evaluation results                           |
| **Scenarios**   | Manage test scenarios with criteria and seed messages               |
| **Personas**    | Manage customer personas for simulations                           |
| **Settings**    |                                                                    |
| › General       | Project name and configuration                                     |
| › Connectors    | Configure connections to LangGraph agents                          |
| › LLM Providers | Configure AI providers (OpenAI, Anthropic) for evaluation and generation |

### 1.5 Projects

**Multi-Project Support:**

- A workspace can contain multiple projects
- All entities are scoped to a single project (no shared data between projects)
- Workspace defined by `evalstudio.config.json` in the root directory

**Project-Scoped Entities:**

```
Workspace (evalstudio.config.json)
└── Project A (projects/{uuid}/)
│   ├── Evals
│   ├── Scenarios
│   ├── Personas
│   └── Settings (Connectors, LLM Providers)
└── Project B (projects/{uuid}/)
    ├── Evals
    ├── Scenarios
    ├── Personas
    └── Settings (Connectors, LLM Providers)
```

---

## 2. Technical Architecture

> **Note:** System Components and Technology Stack have been moved to [ARCHITECTURE.md](ARCHITECTURE.md)

## 3. Package Usage

### CLI Usage (Most Common)

```bash
# Initialize workspace
evalstudio init

# Configure LLM provider
evalstudio llm-provider set --provider openai --api-key sk-...

# Create entities
evalstudio connector create "my-agent" --type langgraph --base-url "http://localhost:2024"
evalstudio persona create "test-user" -d "A typical customer"
evalstudio scenario create "greeting" -i "Say hello" --success-criteria "Agent responds politely"

# Create eval and run it
evalstudio eval create -n "my-eval" -c "my-agent" --scenario "greeting"
evalstudio run create -e "my-eval"
evalstudio run process

# Start API server + Web UI
evalstudio serve --port 3000 --open
```

### API + Web UI Usage (Team Collaboration)

```bash
# Start API server with web UI (default)
evalstudio serve

# Start API server without web UI
evalstudio serve --no-web

# Access web UI at http://localhost:3000
```

## 4. NPM Packages

### Package Scope & Names

- **Core Package**: `@evalstudio/core` - Core evaluation engine (zero dependencies)
- **CLI Package**: `@evalstudio/cli` - CLI, bundles API and Web UI
- **API Package**: `@evalstudio/api` - Fastify REST API server
- **Postgres Package**: `@evalstudio/postgres` - PostgreSQL storage backend (optional)
- **Web Package**: `@evalstudio/web` - React Web UI (private, bundled into CLI)
- **Docs Package**: `@evalstudio/docs` - Documentation site (private)

### Installation

```bash
# CLI (recommended)
npm install -g @evalstudio/cli
# or
npx @evalstudio/cli init

# PostgreSQL backend (optional)
npm install @evalstudio/postgres
```

### Versioning Strategy

- Semantic versioning (semver)
- All packages versioned together (monorepo lockstep)
- Breaking changes in core affect all packages
