# EvalStudio - Architecture

## System Components

The system is built as a monorepo with independent, composable packages:

```
┌─────────────────────────────────────────────────────────────┐
│                     @evalstudio/web                          │
│         (React Frontend - Optional Component)                │
└──────────────────────┬──────────────────────────────────────┘
                       │ REST API / WebSocket
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                   @evalstudio/api                            │
│            (Express/Fastify Server - Optional)               │
│              - REST endpoints                                │
│              - WebSocket for real-time updates               │
│              - Configures core with FileSystem adapter       │
└──────────────────────┬──────────────────────────────────────┘
                       │ imports
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                  evalstudio (Core Engine)                    │
│                  Main Package - Required                     │
│                                                              │
│  ┌──────────────┐  ┌───────────────┐  ┌─────────────────┐ │
│  │ Eval Manager │  │ Eval Executor │  │ Result Analyzer │ │
│  └──────────────┘  └───────────────┘  └─────────────────┘ │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │        Connector Registry & Plugin System            │  │
│  │     (HTTP, LangGraph, Custom Connectors)             │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           Evaluator Implementations                  │  │
│  │  (Exact, Regex, JSON Schema, LLM Judge, Custom)      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Storage Adapters                        │  │
│  │              (File System, Memory)                   │  │
│  └──────────────────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────────────┘
                       │ uses
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                   @evalstudio/cli                            │
│              (Commander.js CLI - Optional)                   │
│              - Interactive test creation                     │
│              - Run evaluations                               │
│              - Report generation                             │
└──────────────────────────────────────────────────────────────┘

                       │ All components interact with
                       ▼
          ┌─────────────────────────────────────┐
          │         Target Systems              │
          │  (Chatbots, REST APIs, Agents)      │
          └─────────────────────────────────────┘

Storage Options (all via Core adapters):
┌────────────────────────────────────────────────────────┐
│  File System (JSON)  │  Memory (for testing)          │
└────────────────────────────────────────────────────────┘
```

**Package Dependencies:**

- `evalstudio` (core): No dependencies on other packages (standalone)
- `@evalstudio/cli`: Depends on `evalstudio` core
- `@evalstudio/api`: Depends on `evalstudio` core
- `@evalstudio/web`: Depends on `@evalstudio/api` (API client)
- `@evalstudio/docs`: Documentation site (independent)

**Key Architectural Decisions:**

1. **Core is King**: The `evalstudio` core package contains ALL business logic for:
   - Test execution
   - Connector system
   - Evaluator implementations
   - Storage adapters
   - This ensures CLI, API, and programmatic usage all behave identically

2. **CLI = Core + Terminal Interface**: The CLI is a thin wrapper around core that:
   - Parses command-line arguments
   - Provides interactive prompts
   - Formats output for terminals
   - Manages local file-based storage

3. **API = Core + HTTP Interface**: The API server is a thin wrapper that:
   - Exposes core functionality via REST endpoints
   - Configures core to use PostgreSQL storage adapter
   - Provides WebSocket for real-time updates
   - Handles authentication and multi-user scenarios

4. **Web = API Client**: The web UI is purely a frontend:
   - Makes HTTP calls to the API server
   - Has no direct access to core evaluation logic
   - Provides visual interface for eval creation and result viewing

5. **Storage Flexibility**: The core supports multiple storage adapters:
   - FileSystem: Git-friendly JSON files (used by CLI and API)
   - Memory: Used for testing and temporary operations

---

## Connector Interface

Connectors implement a common interface for message-based communication:

```typescript
interface Connector {
  name: string;

  // Execute a request and return the response
  execute(request: ConnectorRequest): Promise<ConnectorResponse>;
}

interface ConnectorRequest {
  // Messages for conversational input
  messages: Array<{ role: string; content: string }>;
}

interface ConnectorResponse {
  // Response message
  message: { role: string; content: string };

  // Metadata
  latencyMs: number;
  tokenUsage?: { input: number; output: number };
}
```

**Built-in Connectors:**

| Connector | Description |
|-----------|-------------|
| `HttpConnector` | Generic HTTP/REST API connector |
| `LangGraphConnector` | LangGraph agent connector |

---

## Evaluator Interface

Evaluators assess responses:

```typescript
interface Evaluator {
  name: string;

  // Evaluate a response against expected criteria
  evaluate(context: EvaluatorContext): Promise<EvaluatorResult>;
}

interface EvaluatorContext {
  // The value to evaluate
  value: unknown;

  // Full response for context
  response: ConnectorResponse;

  // Eval criteria
  criteria: EvaluatorCriteria;
}

interface EvaluatorResult {
  pass: boolean;
  score?: number;       // 0-1 for scored evaluations
  reason?: string;      // Explanation of result
  details?: unknown;    // Evaluator-specific details
}
```

**Built-in Evaluators:**

| Evaluator | Description |
|-----------|-------------|
| `ExactMatchEvaluator` | Exact string/value comparison |
| `RegexEvaluator` | Regex pattern matching |
| `JsonSchemaEvaluator` | Validates response against JSON schema |
| `JsonPathEvaluator` | Assertions on JSON path values |
| `LlmJudgeEvaluator` | LLM-based evaluation with custom prompts |
| `CustomEvaluator` | User-provided JavaScript function |

---

## Technology Stack

**Monorepo Structure:**

- Package Manager: Yarn v3+ (workspaces)
- Build System: Turborepo (for efficient builds across packages)
- Shared TypeScript config and tooling across workspaces

**Package: `evalstudio` (Core Engine)**

- Runtime: Node.js 20+ with TypeScript
- LLM Client: Native fetch() to OpenAI and Anthropic APIs
  - Shared `chatCompletion()` utility for both providers
  - LLM Judge evaluators for criteria evaluation
  - Persona message generation
- Storage Adapters: File System (built-in), Memory
- Dependencies: Zero production dependencies
- HTTP Client: Fetch API / Axios (for connectors)
- Execution Engine (pluggable adapters):
  - InMemoryExecutor: Sequential execution, no dependencies (default)
  - WorkerThreadExecutor: Parallel via Node.js worker threads
- Testing: Vitest
- Published as: `evalstudio` on npm

**Package: `@evalstudio/cli`**

- CLI Framework: Commander.js (argument parsing) + Ink (React-based terminal UI)
- Interactive Prompts: Inquirer.js or Prompts
- Progress/Spinners: Ink built-in components (or ora for simple scripts)
- File Watcher: Chokidar (for watch mode)
- Storage: Configures core with FileSystem adapter
- Execution: Configures core with WorkerThreadExecutor (no Redis needed)
- Report Generation: Generate HTML from templates
- Published as: `@evalstudio/cli` on npm (or bundled with main package)

**Package: `@evalstudio/api`**

- Framework: Fastify
- API: RESTful + WebSocket for real-time updates
- Storage: Configures core with FileSystem adapter
- Execution: Configures core with WorkerThreadExecutor
- Authentication: JWT (optional feature)
- Published as: `@evalstudio/api` on npm

**Package: `@evalstudio/web`**

- Framework: React 18+ with TypeScript (Vite for build)
- Server State: TanStack Query (data fetching, caching)
- Client State: Zustand (minimal, only if needed)
- UI Components: shadcn/ui (Radix UI + Tailwind CSS)
- Form Management: React Hook Form + Zod
- API Client: TanStack Query (React Query)
- Code Editor: Monaco Editor (for custom validators/JSON editing)
- Charts: Recharts (pass rate, latency trends, performance over time)
- Build: Static assets served by API server or CDN
- Published as: `@evalstudio/web` on npm

**Package: `@evalstudio/docs`**

- Documentation: Docusaurus (React-based)
- Content: Markdown-based documentation
- Hosted: GitHub Pages or Vercel
- Published as: `@evalstudio/docs` on npm

**Shared Dependencies:**

- TypeScript 5+
- ESLint + Prettier (code quality)
- Vitest (testing across all packages)
- Native fetch() for LLM API calls (OpenAI, Anthropic)

**Development Environment:**

- Environment-based configuration (dotenv)
