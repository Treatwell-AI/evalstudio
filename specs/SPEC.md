# EvalStudio - Specification Document

**Version:** 2.0
**Date:** 2026-01-25
**Status:** Draft

---

## Design Principles

- **Three Interfaces**: CLI, Web UI, and REST API - all equal first-class citizens
- **Shared Core Engine**: All interfaces use the same evaluation engine and business logic
- **CI-Ready**: CLI designed for automated testing in CI/CD pipelines
- **API Integration**: REST API for programmatic access and custom integrations
- **Decoupled Architecture**: Core engine, API server, and Web UI are independent modules
- **Flexible Storage**: File-based JSON storage (git-friendly, works with CLI, API, and Web)

---

## 1. Product Requirements

### 1.1 Core Features

#### Eval Management

- **Multiple Creation Methods**:
  - CLI: Interactive prompts or direct JSON file editing
  - Web UI: Visual eval editor with form-based creation
  - API: Programmatic eval creation via REST endpoints
- **Flexible Storage**:
  - File-based: JSON files in project directory (git-friendly)
  - All interfaces (CLI, API, Web) use the same file-based storage
- **Eval Organization**: Group related evals into named groups
- **Version Control**: Git-friendly JSON format for file-based evals

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

- **Pluggable Architecture**: Define connectors for different endpoint types
- **Built-in Connectors**:
  - Generic HTTP/REST API
  - LangGraph-based agents
  - Custom connector support via plugin system
- **Configuration**: Store endpoint URLs, authentication, and connector-specific settings

#### Evaluation Execution

- **CLI Execution**: Run evals via `evalstudio run <suite>` command
- **CI/CD Integration**: Exit codes and JSON output for automation
- **Parallel Execution**: Configurable concurrency for multiple tests
- **Progress Tracking**: Terminal progress bars and real-time status
- **Retry Logic**: Handle transient failures gracefully
- **Watch Mode**: Re-run tests on file changes (dev mode)

#### Evaluation Methods

- **Expected Outcome Matching**:
  - Exact string match on message content
  - Regex pattern matching
  - JSON schema validation (validates response structure)
  - JSONPath assertions (e.g., `$.status == "success"`, `$.items.length > 0`)
  - Custom JavaScript validators
- **LLM-as-Judge**:
  - Configurable LLM provider (OpenAI, Anthropic, etc.)
  - Custom evaluation prompts
  - Scoring rubrics (1-5 scale, pass/fail, etc.)
  - Cost tracking for LLM evaluation calls

#### Results & Reporting

- **CLI Output**: Formatted terminal output with pass/fail summary
- **File Output**: Results saved as JSON files (local or custom path)
- **CI/CD Friendly**: Exit codes (0 for pass, 1 for fail), structured JSON
- **Web Dashboard**: Browse and compare runs visually
- **Metrics**:
  - Pass/fail rates
  - Response latency
  - Token usage (if available from connector)
  - LLM judge scores
  - Historical comparisons

### 1.2 Glossary & User Stories

> **Note:** Glossary and User Stories have been moved to [USER-STORIES.md](USER-STORIES.md)

### 1.3 User Workflows

#### CLI Workflow (Developer/CI)

1. Install: `npm install -g evalstudio` or `npx evalstudio`
2. Initialize: `evalstudio init` (creates config and eval directory structure)
3. Create eval: `evalstudio eval create` (interactive prompts) or edit JSON files
4. Run evals: `evalstudio run <suite-name>` or `evalstudio run evals/my-eval.json`
5. View results: Terminal output + JSON file saved locally
6. CI Integration: Use exit codes and JSON output for automation

#### Web UI Workflow (QA/PM)

1. Start server: `evalstudio serve` or deploy server separately
2. Navigate to Web UI (e.g., http://localhost:3000)
3. Create eval via visual editor (drag-and-drop conversation builder)
4. Save eval to group
5. Run evaluation from UI
6. View results in dashboard with charts and comparisons

#### API Workflow (Developer)

1. Start API server: `evalstudio serve --api-only`
2. Make API calls to create/manage evals programmatically
3. Trigger evaluation runs via POST request
4. Poll for results or use webhooks
5. Integrate into custom automation/monitoring systems

### 1.4 Web UI Structure

**Left Sidebar Navigation:**

```
├── Dashboard
├── Evals
├── ─────────────
├── Scenarios
├── Personas
├── Settings
│   ├── Connectors
│   ├── LLM Providers
│   └── Users
```

| Section         | Description                                                        |
| --------------- | ------------------------------------------------------------------ |
| **Dashboard**   | Overview metrics, recent evals, quick actions                      |
| **Evals**       | Create, run, and view evaluation batches                           |
| **Scenarios**   | Manage test scenarios (issue/request definitions)                  |
| **Personas**    | Manage customer personas for simulations                           |
| **Settings**    |                                                                    |
| › Connectors    | Configure connections to tested agents (HTTP, LangGraph)           |
| › LLM Providers | Configure AI providers (OpenAI, Anthropic) for personas and judges |
| › Users         | Manage user access and privileges (per-project)                    |

### 1.5 Projects & Permissions

**Multi-Project Support:**

- An account can contain multiple projects
- All entities are scoped to a single project (no shared data between projects)
- Users can be invited to specific projects with different roles

**Project-Scoped Entities:**

```
Account
└── Project A
│   ├── Evals
│   ├── Scenarios
│   ├── Personas
│   └── Settings (Connectors, LLM Providers, Users)
└── Project B
    ├── Evals
    ├── Scenarios
    ├── Personas
    └── Settings (Connectors, LLM Providers, Users)
```

**User Roles (per-project):**

| Role       | Evals, Scenarios, Personas | Settings    | Removable |
| ---------- | -------------------------- | ----------- | --------- |
| **Viewer** | Read                       | No access   | Yes       |
| **Member** | Read, Write                | No access   | Yes       |
| **Admin**  | Read, Write                | Read, Write | Yes       |
| **Owner**  | Read, Write                | Read, Write | No        |

**Permissions Matrix:**

| Action                  | Viewer | Member | Admin | Owner |
| ----------------------- | ------ | ------ | ----- | ----- |
| View evals and results  | ✓      | ✓      | ✓     | ✓     |
| Create/edit evals       |        | ✓      | ✓     | ✓     |
| Create/edit scenarios   |        | ✓      | ✓     | ✓     |
| Create/edit personas    |        | ✓      | ✓     | ✓     |
| Run evals               |        | ✓      | ✓     | ✓     |
| Configure connectors    |        |        | ✓     | ✓     |
| Configure LLM providers |        |        | ✓     | ✓     |
| Manage project users    |        |        | ✓     | ✓     |
| Transfer ownership      |        |        |       | ✓     |
| Delete project          |        |        |       | ✓     |

> **Note:** Owner is automatically assigned to the project creator and cannot be removed. Ownership can only be transferred to another user.

---

## 2. Technical Architecture

> **Note:** System Components and Technology Stack have been moved to [ARCHITECTURE.md](ARCHITECTURE.md)

## 6. Package Interaction & Usage Patterns

### Standalone Core Usage (Programmatic)

```typescript
import { EvalStudio, HttpConnector, ExactMatchEvaluator } from "evalstudio";

const studio = new EvalStudio({
  storage: "filesystem",
  basePath: "./eval-tests",
});

// Load and run tests programmatically
const results = await studio.runSuite("my-suite");
console.log(results.summary);
```

### CLI Usage (Most Common)

```bash
# Initialize project
evalstudio init

# Create eval interactively
evalstudio eval create

# Run evals
evalstudio run my-suite --parallel 10

# Generate HTML report
evalstudio report results.json --output report.html

# Start API server (optional)
evalstudio serve --port 3000
```

### API + Web UI Usage (Team Collaboration)

```bash
# Start API server with web UI
evalstudio serve --web

# Or run API server separately
npm install @evalstudio/api
npx @evalstudio/api start

# Access web UI at http://localhost:3000
```

### Hybrid Usage (Best of Both)

```bash
# Developers use CLI locally
evalstudio run regression-tests

# CI/CD uses CLI
evalstudio run --ci --reporter json > results.json

# Team uses Web UI for test creation and analysis
evalstudio serve --web

# All tests stored as JSON files in git
# CLI, API, and Web UI all use the same storage
```

---

## 7. NPM Package Publishing

### Package Scope & Names

- **Main Package**: `evalstudio` - Core evaluation engine
- **CLI Package**: `@evalstudio/cli` - Command-line interface (may be bundled with main)
- **API Package**: `@evalstudio/api` - REST API server
- **Web Package**: `@evalstudio/web` - Web UI (static build or npm package)
- **Docs Package**: `@evalstudio/docs` - Documentation site

### Installation Methods

**CLI Usage (Global Install):**

```bash
npm install -g evalstudio
# or
npx evalstudio init
```

**Programmatic Usage:**

```bash
npm install evalstudio
```

**API Server:**

```bash
npm install @evalstudio/api
# or
npx @evalstudio/api start
```

**Web UI (Development):**

```bash
npm install @evalstudio/web
```

### Versioning Strategy

- Use semantic versioning (semver)
- All packages versioned together (monorepo lockstep)
- Breaking changes in core affect all packages
