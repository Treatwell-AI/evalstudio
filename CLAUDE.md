# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

EvalStudio is a flexible evaluation platform for testing chatbots, AI agents, and REST APIs. It's built as a Turborepo monorepo with 5 packages that provide CLI, API, and Web interfaces for running multi-turn conversation tests with LLM-as-judge evaluation.

## Development Commands

### Monorepo Commands (run from root)

```bash
# Build all packages (respects dependencies)
pnpm build

# Run tests across all packages
pnpm test

# Typecheck all packages
pnpm typecheck

# Lint all packages
pnpm lint

# Development mode (watch mode for all packages)
pnpm dev

# Clean build artifacts
pnpm clean
```

### Per-Package Commands

```bash
# Work on a specific package
pnpm --filter @evalstudio/core build
pnpm --filter @evalstudio/cli test
pnpm --filter @evalstudio/api dev
pnpm --filter @evalstudio/web build

# Run a single test file
pnpm --filter @evalstudio/core test run-processor.test.ts

# Watch mode for tests
pnpm --filter @evalstudio/core test:watch
```

### Starting the Stack

```bash
# Start API + Web UI on one port (after building)
evalstudio serve

# Or with options
evalstudio serve --port 8080 --open

# Dev mode: API server + Vite dev server (hot reload)
pnpm --filter @evalstudio/api start   # API on port 3000
pnpm --filter @evalstudio/web dev     # Web on port 5173 (proxies /api to 3000)
```

### CLI Usage

```bash
# After building, use the CLI locally
pnpm --filter @evalstudio/cli build
node packages/cli/dist/index.js status

# Or install globally
npm install -g evalstudio
evalstudio status
```

## Architecture

### Package Structure & Dependencies

```
@evalstudio/core                     ← Core evaluation engine (standalone)
    ↑
    ├── @evalstudio/cli              ← Command-line interface
    ├── @evalstudio/api              ← REST API server (Fastify)
    │       ↑
    │       └── @evalstudio/web      ← React frontend (API client)
    └── @evalstudio/docs             ← Documentation (independent)
```

**Critical Design Principle**: All business logic lives in `@evalstudio/core`. The CLI and API are thin wrappers that provide interfaces (terminal vs HTTP) but delegate all evaluation logic to core. This ensures identical behavior across all interfaces.

### Domain Model (Core Entities)

A project is defined by an `evalstudio.config.json` file in a directory (one folder = one project). The domain follows this hierarchy:

```
Project (defined by evalstudio.config.json in a directory)
  ├── LLMProvider (OpenAI/Anthropic config for evaluation/generation)
  ├── Connector (HTTP/LangGraph endpoint configuration)
  ├── Persona (test user description, e.g., "frustrated customer")
  ├── Scenario (test situation with optional seed messages)
  └── Eval (combines scenarios + personas + success/failure criteria)
       └── Execution (groups runs from a single eval execution, auto-increment ID)
            └── Run (single test: scenario + persona → conversation → result)
```

**Key Concepts**:

- **Project**: Not a stored entity -- defined by the presence of `evalstudio.config.json` in a directory. Project settings (name, LLM config, observability) live in this config file.
- **Eval**: Combines one or more scenarios with criteria. Each scenario can specify which personas to use.
- **Execution**: Groups all runs created together (e.g., running an eval with 3 scenarios × 2 personas = 6 runs share the same executionId)
- **Run**: Represents a single scenario/persona combination test. Contains the conversation messages, connector response, and evaluation result.
- **RunProcessor**: Background service that polls for queued runs and executes them via connectors with configurable concurrency.

### Message-Based Format

EvalStudio uses a message-based format (OpenAI chat format):

- Input: Array of `{role, content}` messages
- Output: Message response from the agent
- Evaluation: Applied to the message content

Connectors must implement this interface:

```typescript
interface ConnectorRequest {
  messages: Array<{ role: string; content: string }>;
}

interface ConnectorResponse {
  message: { role: string; content: string };
  latencyMs: number;
  tokenUsage?: { input: number; output: number };
}
```

### Storage

- **Location**: JSON files in `data/` inside the project directory (configured via `getProjectDir()`)
- **Format**: One JSON file per entity type (personas.json, scenarios.json, evals.json, runs.json, executions.json)
- **Design**: Git-friendly, human-readable, works seamlessly across CLI/API/Web
- **Access**: All CRUD operations go through `packages/core/src/*.ts` modules (e.g., `persona.ts`, `eval.ts`, `run.ts`)

### Evaluation Flow

1. Create an Eval (scenario + persona combinations + criteria)
2. Trigger execution → creates Execution + multiple Runs (status: "queued")
3. RunProcessor polls for queued runs
4. For each run:
   - Load scenario seed messages
   - Generate persona message (if needed)
   - Invoke connector with messages
   - Evaluate response against criteria (success/failure)
   - Update run status to "completed" with result
5. Results stored in run.result: `{success: boolean, score?: number, reason?: string}`

### Connectors

Built-in connector types:

- **HttpConnector**: Generic REST API (configurable method, headers, auth)
- **LangGraphConnector**: LangGraph agents via message-based API

All connectors stored in `connectors.json`, referenced by evals via `connectorId`.

### Evaluators

- **LLM-as-Judge**: Uses direct OpenAI/Anthropic API calls to evaluate responses against natural language criteria
- **Exact Match**: String comparison
- **Regex**: Pattern matching
- **JSON Schema**: Validates response structure
- **Custom**: User-provided JavaScript functions

## Tech Stack Details

### Core (`@evalstudio/core`)

- Runtime: Node.js 20+, TypeScript 5.7+, ESM modules
- LLM: Native fetch() to OpenAI and Anthropic APIs (via shared llm-client.ts)
- Dependencies: Zero production dependencies
- Testing: Vitest

### CLI (`@evalstudio/cli`)

- Framework: Commander.js
- Published as: `@evalstudio/cli` npm package (depends on `@evalstudio/core`)

### API (`@evalstudio/api`)

- Framework: Fastify 5
- WebSocket: For real-time run status updates (future)
- Port: 3000 (default, configurable via `EVALSTUDIO_PORT` env var)
- Routes: All endpoints under `/api` prefix (e.g., `/api/project`, `/api/runs`)

### Web (`@evalstudio/web`)

- Framework: React 18 + TypeScript
- Build: Vite 6
- State: TanStack Query (React Query) for server state
- Routing: React Router v7
- Charts: Recharts (for performance metrics)
- Testing: Vitest + @testing-library/react

### Build System

- Package Manager: pnpm 9.15.0 with workspaces
- Build Tool: Turborepo 2.3.3 (task orchestration)
- Compiler: TypeScript 5.7.3 (tsc)
- Config: `tsconfig.base.json` (shared), per-package extends

## Code Organization

### Core Package (`packages/core/src/`)

- `project.ts` - Project config management (reads/writes `evalstudio.config.json`)
- `persona.ts` - Persona CRUD
- `scenario.ts` - Scenario CRUD
- `eval.ts` - Eval CRUD
- `run.ts` - Run CRUD
- `execution.ts` - Execution CRUD
- `connector.ts` - Connector management + invocation
- `llm-provider.ts` - LLM provider configuration
- `run-processor.ts` - Background processor for queued runs
- `llm-client.ts` - Shared LLM client (native fetch to OpenAI/Anthropic APIs)
- `evaluator.ts` - Evaluation logic (LLM-as-judge, criteria)
- `persona-generator.ts` - Generate persona messages with LLM
- `prompt.ts` - System prompt building for test agents
- `storage.ts` - Project directory management
- `types.ts` - Shared types (Message, ToolCall, etc.)

### CLI Package (`packages/cli/src/`)

- `index.ts` - Main CLI entry point
- `commands/` - Command implementations (status, init, etc.)

### API Package (`packages/api/src/`)

- `index.ts` - Fastify server setup
- `routes/` - REST API endpoints

### Web Package (`packages/web/src/`)

- `pages/` - Route components (Dashboard, Eval, Run, Persona, Scenario pages)
- `components/` - Reusable UI components
- `hooks/` - Custom React hooks
- `lib/` - Utilities and API client

## Testing

### Running Tests

```bash
# All tests
pnpm test

# Specific package
pnpm --filter @evalstudio/core test

# Watch mode
pnpm --filter @evalstudio/core test:watch

# Single test file
pnpm --filter @evalstudio/core test run-processor.test.ts
```

### Test Location

Tests are co-located with source in `__tests__/` directories:

- `packages/core/src/__tests__/`
- `packages/cli/src/__tests__/`
- `packages/api/src/__tests__/`
- `packages/web/src/__tests__/`

### Test Framework

- Vitest with jsdom for React component tests
- @testing-library/react for component testing

## Common Patterns

### Adding a New Field to an Entity

When adding a field to an entity (e.g., Persona, Scenario, Eval):

1. Update the interface in `packages/core/src/<entity>.ts`
2. Update the CreateInput/UpdateInput types
3. Update CRUD functions to handle the new field
4. Update storage files will auto-migrate (append new field)
5. Update API routes in `packages/api/src/routes/<entity>.ts`
6. Update web forms/displays in `packages/web/src/pages/` or `packages/web/src/components/`

### Adding a New Connector Type

1. Define connector config interface in `packages/core/src/connector.ts`
2. Add type to `ConnectorType` union
3. Implement invoke logic in `invokeConnector()` function
4. Add to `getConnectorTypes()` export
5. Update web UI forms to support new config fields

### Adding a New Evaluator

1. Add criteria interface in `packages/core/src/evaluator.ts`
2. Implement evaluation logic in `evaluateCriteria()` function
3. Update web UI to show evaluator-specific results

## Custom Skills

This project includes custom Claude Code skills (invoked with `/skillname`):

- `/feature` - Start new feature workflow (creates branch, tracks progress)
- `/feature validate` - Run validation (typecheck, lint, test, build)
- `/feature changelog` - Generate changelog entry from commits
- `/feature docs` - Update documentation
- `/feature complete` - Run validation + changelog + commit
- `/validate` - Run all validation steps
- `/changelog` - Generate changelog from git history
- `/docs` - Update documentation

## Important Notes

### File Paths

- Always use `.js` extensions in imports (ESM requirement), even though source files are `.ts`
- Example: `import { getPersona } from "./persona.js";`

### Project Directory

- Default: walks up from `cwd` looking for `evalstudio.config.json`, uses `data/` next to it
- Override: `setProjectDir(path)` or `EVALSTUDIO_PROJECT_DIR` env var
- Reset: `resetProjectDir()` (useful in tests)

### Module Resolution

- `"module": "NodeNext"` and `"moduleResolution": "NodeNext"` in tsconfig
- Compiled output goes to `dist/` directory
- Source files in `src/` directory

### Turborepo Task Dependencies

- `build` depends on `^build` (dependent packages build first)
- `test` depends on `build` (tests run on compiled code)
- `typecheck` depends on `^build` (needs dependency types)

### Data Consistency

- Runs reference evalId, scenarioId, personaId, connectorId - validate these exist before creating
- executionId is auto-increment, groups runs created in batch

## Recent Changes

- Removed LangChain dependencies (`@langchain/core`, `@langchain/openai`, `@langchain/anthropic`) from core package
  - Replaced with direct `fetch()` calls to OpenAI and Anthropic APIs via shared `llm-client.ts`
  - Removed `zod` — core package now has zero production dependencies
- Added observability configuration for Langfuse and LangSmith tracing
  - Project-level observability settings in `evalstudio.config.json`
  - Automatic callback injection for LLM calls (evaluation and persona generation)
  - CLI commands, API endpoints, and Web UI settings page
- Switched to single-project mode: one directory = one project
  - Project defined by `evalstudio.config.json` in a directory
  - Data stored in `data/` subdirectory (replaces `~/.evalstudio/`)
  - Removed `projectId` from all entities
  - `EVALSTUDIO_PROJECT_DIR` env var replaces `EVALSTUDIO_STORAGE_DIR`
- Removed unused fields from connectors and evals (ioMode, responseFormat, agentVersion)
- All connectors now use message-based format only
- executionId is now automatically assigned to group related runs
- Web UI includes floating status bar with dynamic version display
