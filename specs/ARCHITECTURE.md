# EvalStudio - Architecture

## System Components

The system is built as a monorepo with independent, composable packages:

```
┌─────────────────────────────────────────────────────────────┐
│                     @evalstudio/web                         │
│            (React Frontend - bundled in CLI)                │
└──────────────────────┬──────────────────────────────────────┘
                       │ REST API calls
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                   @evalstudio/api                           │
│                 (Fastify Server)                            │
│              - REST endpoints under /api                    │
│              - Serves web UI static assets                  │
└──────────────────────┬──────────────────────────────────────┘
                       │ imports
                       │
┌──────────────────────▼─────────────────────────────────────┐
│               @evalstudio/core (Core Engine)               │
│                  All business logic                        │
│                                                            │
│  ┌──────────────┐  ┌───────────────┐  ┌─────────────────┐  │
│  │  Eval CRUD   │  │ RunProcessor  │  │  LLM Client     │  │
│  └──────────────┘  └───────────────┘  └─────────────────┘  │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           Connector Strategies                       │  │
│  │                (LangGraph)                           │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │       Evaluators (LLM-as-Judge + Custom)             │  │
│  │  Built-in metrics: tool-call-count, token-usage      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │     StorageProvider interface (pluggable backend)    │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
         ▲                             ▲
         │ imports                     │ implements StorageProvider
         │                             │
┌────────┴───────────┐     ┌───────────┴──────────────────────┐
│  @evalstudio/cli   │     │       @evalstudio/postgres       │
│  (Commander.js)    │     │  (PostgreSQL storage backend)    │
│  - CLI commands    │     │  - pg driver                     │
│  - Embeds API +    │     │  - Schema migrations             │
│    Web via serve   │     └──────────────────────────────────┘
└────────────────────┘

Storage Options (selected via evalstudio.config.json):
┌───────────────────────────────────────────────────────────────┐
│ Filesystem (JSON files)  │  PostgreSQL (@evalstudio/postgres) │
└───────────────────────────────────────────────────────────────┘
```

**Package Dependencies:**

- `@evalstudio/core`: No dependencies on other packages (standalone, zero production deps)
- `@evalstudio/cli`: Depends on `@evalstudio/core` and `@evalstudio/api`
- `@evalstudio/api`: Depends on `@evalstudio/core`
- `@evalstudio/postgres`: Depends on `@evalstudio/core`
- `@evalstudio/web`: No package dependencies on other workspace packages (communicates with API via HTTP at runtime)
- `@evalstudio/docs`: Documentation site (independent)

**Key Architectural Decisions:**

1. **Core is King**: The `@evalstudio/core` package contains ALL business logic for:
   - Entity CRUD (personas, scenarios, evals, runs, executions, connectors)
   - Run processing and connector invocation
   - Evaluator framework (LLM-as-judge criteria + custom evaluators)
   - Storage abstraction (StorageProvider interface)
   - This ensures CLI, API, and programmatic usage all behave identically

2. **CLI = Core + API + Terminal Interface**: The CLI is a thin wrapper around core that:
   - Parses command-line arguments via Commander.js
   - Formats output for terminals (text and `--json`)
   - Embeds the API server and Web UI via the `serve` command

3. **API = Core + HTTP Interface**: The API server is a thin wrapper that:
   - Exposes core functionality via REST endpoints under `/api`
   - Serves the web UI as static assets
   - Configures the appropriate StorageProvider (filesystem or postgres)

4. **Web = API Client**: The web UI is purely a frontend:
   - Makes HTTP calls to the API server
   - Has no direct access to core evaluation logic
   - Bundled as static assets into the CLI package at build time

5. **Storage Flexibility**: The core defines a `StorageProvider` interface:
   - **FilesystemStorageProvider**: Git-friendly JSON files in `projects/{id}/data/` (built-in)
   - **PostgresStorageProvider**: Full PostgreSQL backend via `@evalstudio/postgres` (optional)

---

## Connector Interface

Connectors implement a strategy pattern for message-based communication with target systems:

```typescript
interface ConnectorInvokeInput {
  messages: Message[];
  runId?: string;
  seenMessageIds?: Set<string>;
  extraHeaders?: Record<string, string>;
}

interface ConnectorInvokeResult {
  success: boolean;
  latencyMs: number;
  messages?: Message[];
  rawResponse?: string;
  error?: string;
  tokensUsage?: TokensUsage;
  threadId?: string;
}
```

**Built-in Connectors:**

| Connector            | Description                                             |
| -------------------- | ------------------------------------------------------- |
| `LangGraphConnector` | LangGraph Dev API connector for langgraph-backed agents |

---

## Evaluator Interface

Two evaluation systems run on each conversation turn:

1. **LLM-as-Judge (criteria)**: Evaluates responses against natural language success/failure criteria defined on the scenario. Gates pass/fail.
2. **Custom evaluators**: Pluggable evaluator definitions registered via `EvaluatorRegistry`. Two kinds:
   - **Assertions**: Pass/fail gates (failure stops the run)
   - **Metrics**: Measurements only (never cause failure)

```typescript
interface EvaluatorDefinition {
  type: string;
  label: string;
  description?: string;
  kind: "assertion" | "metric";
  auto?: boolean;
  configSchema?: JsonSchema;
  evaluate(ctx: EvaluatorContext): Promise<EvaluationResult>;
}
```

**Built-in Evaluators:**

| Evaluator         | Kind   | Auto | Description                                |
| ----------------- | ------ | ---- | ------------------------------------------ |
| `tool-call-count` | metric | no   | Counts tool calls per conversation turn    |
| `token-usage`     | metric | yes  | Reports input/output/total tokens per turn |

Evaluators with `auto: true` run on every scenario automatically. Others must be explicitly added to a scenario's `evaluators[]` array.

---

## Technology Stack

**Monorepo Structure:**

- Package Manager: pnpm 9.15+ (workspaces)
- Build System: Turborepo (task orchestration across packages)
- Shared TypeScript config via `tsconfig.base.json`

**Package: `@evalstudio/core` (Core Engine)**

- Runtime: Node.js 20+ with TypeScript (ESM)
- LLM Client: Native fetch() to OpenAI and Anthropic APIs
  - Shared `chatCompletion()` utility for both providers
  - LLM-as-judge criteria evaluation
  - Persona message generation
- Storage: StorageProvider interface with built-in FilesystemStorageProvider
- Dependencies: Zero production dependencies
- HTTP Client: Native fetch() (for connectors)
- Testing: Vitest
- Published as: `@evalstudio/core` on npm

**Package: `@evalstudio/cli`**

- CLI Framework: Commander.js
- Embeds `@evalstudio/api` for the `serve` command
- Bundles web UI static assets via postbuild step
- Published as: `@evalstudio/cli` on npm

**Package: `@evalstudio/api`**

- Framework: Fastify 5
- API: RESTful endpoints under `/api` prefix
- Serves web UI static assets via `@fastify/static`
- Published as: `@evalstudio/api` on npm

**Package: `@evalstudio/postgres`**

- PostgreSQL storage backend implementing StorageProvider
- Driver: pg (node-postgres)
- Schema migrations built-in
- Published as: `@evalstudio/postgres` on npm

**Package: `@evalstudio/web`**

- Framework: React 18 with TypeScript
- Build: Vite 6
- Server State: TanStack Query (React Query)
- Routing: React Router v7
- Charts: Recharts
- Styling: Custom CSS with CSS variables
- Private package (bundled into CLI)

**Package: `@evalstudio/docs`**

- Documentation: Docusaurus
- Content: Markdown-based documentation
- Private package

**Shared Tooling:**

- TypeScript 5.7+
- ESLint (code quality)
- Vitest (testing across all packages)
- Native fetch() for all HTTP calls (LLM APIs, connectors)
