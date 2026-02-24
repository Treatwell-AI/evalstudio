# Spec: Custom Connectors and Custom Evaluators

## Summary

Allow developers to extend EvalStudio with custom connectors and custom evaluators by creating npm packages (or local files) that implement well-defined plugin interfaces. A developer installs `@evalstudio/core`, writes a connector for their specific agent or an evaluator with custom logic, and registers it in `evalstudio.config.json`. EvalStudio discovers and loads these plugins at runtime.

## Motivation

- **Connectors**: The built-in HTTP and LangGraph connectors cover common cases, but many teams have agents with custom protocols, authentication flows, multi-step invocations, or proprietary SDKs. Today, the only option is to wrap the agent behind a generic HTTP endpoint — adding infra overhead and losing context.
- **Evaluators**: LLM-as-judge with success/failure criteria is powerful but not always sufficient. Teams need deterministic checks (latency thresholds, token budgets, structured output validation), domain-specific evaluation (medical accuracy, legal compliance), or composite scoring that combines multiple signals. Currently there's no way to plug these in.

---

## Developer Experience

This section shows the complete experience from a developer's perspective: what their project looks like, how they write plugins, and how everything connects.

### The Eval Project

A team is evaluating their booking assistant agent. They need a custom connector (their agent uses a proprietary SDK, not plain HTTP) and a custom evaluator (responses must be valid JSON matching a schema).

#### Folder Structure

```
booking-agent-evals/
  evalstudio.config.json          ← project config, declares plugins
  package.json                    ← npm project with evalstudio + plugins
  tsconfig.json                   ← TypeScript config
  data/                           ← EvalStudio data (scenarios, runs, etc.)
  src/
    connector.ts                  ← custom connector for the booking agent
    evaluators/
      availability-check.ts       ← verifies claims against real booking system
  dist/                           ← compiled JS (git-ignored)
```

#### package.json

```json
{
  "name": "booking-agent-evals",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "serve": "evalstudio serve",
    "eval": "evalstudio eval run"
  },
  "dependencies": {
    "@evalstudio/core": "^0.5.0",
    "@booking/agent-sdk": "^2.1.0"
  },
  "devDependencies": {
    "evalstudio": "^0.5.0",
    "typescript": "^5.7.0"
  }
}
```

Key points:
- `@evalstudio/core` is a **runtime dependency** — plugins import types and helpers from it
- `evalstudio` (the CLI) is a **devDependency** — used for `serve` and `eval` scripts
- `@booking/agent-sdk` is the team's own agent SDK, used by the connector and the availability-check evaluator
- `"type": "module"` — ESM, matching evalstudio's module format
- `build` compiles TypeScript to `dist/`, which is what evalstudio loads at runtime

#### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "declaration": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

#### evalstudio.config.json

```json
{
  "version": 2,
  "name": "booking-agent-evals",
  "plugins": [
    "./dist/connector.js",
    "./dist/evaluators/availability-check.js"
  ],
  "llmSettings": {
    "provider": "openai",
    "apiKey": "${OPENAI_API_KEY}",
    "models": {
      "evaluation": "gpt-4o",
      "persona": "gpt-4o-mini"
    }
  }
}
```

Plugin paths point to the **compiled JS** in `dist/`, not the TypeScript source. The developer runs `pnpm build` (or `pnpm dev` for watch mode) before starting evalstudio.

---

### Writing a Custom Connector

The booking agent uses a proprietary SDK that handles authentication, session management, and streaming internally. Wrapping it behind a generic HTTP endpoint would lose the session context and require a separate proxy service.

```typescript
// src/connector.ts
import { defineConnector } from "@evalstudio/core";
import { BookingAgent } from "@booking/agent-sdk";

export default defineConnector({
  type: "booking-agent",
  label: "Booking Agent",
  description: "Connects to the Booking Agent via its native SDK",

  configSchema: {
    type: "object",
    properties: {
      environment: {
        type: "string",
        title: "Environment",
        enum: ["staging", "production"],
        default: "staging",
      },
      region: {
        type: "string",
        title: "Region",
        enum: ["eu-west-1", "us-east-1"],
        default: "eu-west-1",
      },
    },
    required: ["environment"],
  },

  async invoke(ctx) {
    const { environment, region } = ctx.connector.config as {
      environment: string;
      region?: string;
    };

    const agent = new BookingAgent({
      baseUrl: ctx.connector.baseUrl,
      environment,
      region: region ?? "eu-west-1",
      apiKey: ctx.connector.headers?.["x-api-key"],
    });

    const start = Date.now();
    const response = await agent.chat({
      messages: ctx.messages,
      sessionId: ctx.run?.threadId,
    });

    return {
      success: true,
      latencyMs: Date.now() - start,
      messages: [{ role: "assistant", content: response.text }],
    };
  },

  async test(ctx) {
    const agent = new BookingAgent({
      baseUrl: ctx.connector.baseUrl,
      apiKey: ctx.connector.headers?.["x-api-key"],
    });

    const start = Date.now();
    const health = await agent.healthCheck();
    return {
      success: health.ok,
      latencyMs: Date.now() - start,
      response: health.ok ? `Agent v${health.version} healthy` : undefined,
      error: health.ok ? undefined : health.error,
    };
  },
});
```

The developer then creates a connector in the EvalStudio UI, selects "Booking Agent" from the type dropdown, fills in the auto-generated form (environment, region), and sets the baseUrl and API key header.

---

### Writing a Custom Evaluator

Custom evaluators are for domain-specific checks that go beyond what built-in evaluators can do. Common built-in evaluators like latency budget, regex matching, JSON schema validation, and token budget ship with EvalStudio — you don't need plugins for those.

Plugins shine when you need to call external services, use domain SDKs, or implement business-specific logic.

#### Availability Check

The booking agent claims appointment slots are available. This evaluator verifies those claims against the real booking system — something no LLM judge or pattern matcher can do.

```typescript
// src/evaluators/availability-check.ts
import { defineEvaluator } from "@evalstudio/core";
import { BookingAPI } from "@booking/agent-sdk";

export default defineEvaluator({
  type: "availability-check",
  label: "Availability Check",
  description: "Verifies that availability claims in the agent's response match the real booking system",

  configSchema: {
    type: "object",
    properties: {
      apiUrl: {
        type: "string",
        title: "Booking API URL",
        description: "Base URL for the availability API",
      },
    },
    required: ["apiUrl"],
  },

  async evaluate(ctx) {
    const lastAssistant = ctx.lastInvocation.messages.find(
      (m) => m.role === "assistant"
    );
    if (!lastAssistant || typeof lastAssistant.content !== "string") {
      return { success: true, reason: "No assistant message to check" };
    }

    // Extract date/time claims from the response
    const slotPattern = /available.*?(\d{4}-\d{2}-\d{2}).*?(\d{2}:\d{2})/gi;
    const claims = [...lastAssistant.content.matchAll(slotPattern)];
    if (claims.length === 0) {
      return { success: true, reason: "No availability claims found" };
    }

    // Verify each claim against the real booking system
    const api = new BookingAPI({ baseUrl: (ctx.config as { apiUrl: string }).apiUrl });
    const incorrect: string[] = [];

    for (const [, date, time] of claims) {
      const real = await api.checkSlot(date, time);
      if (!real.available) {
        incorrect.push(`${date} ${time}`);
      }
    }

    if (incorrect.length > 0) {
      return {
        success: false,
        score: 1 - incorrect.length / claims.length,
        reason: `Agent claimed availability for slots that are not available: ${incorrect.join(", ")}`,
        metadata: { claimsChecked: claims.length, incorrectSlots: incorrect },
      };
    }

    return {
      success: true,
      score: 1,
      reason: `All ${claims.length} availability claims verified`,
    };
  },
});
```

---

### Workflow

```bash
# 1. Set up the eval project
mkdir booking-agent-evals && cd booking-agent-evals
npm init -y
npm install @evalstudio/core @booking/agent-sdk
npm install -D evalstudio typescript
evalstudio init

# 2. Write connector and evaluators (src/connector.ts, src/evaluators/availability-check.ts)

# 3. Build
pnpm build                       # or: pnpm dev (watch mode)

# 4. Add plugins to evalstudio.config.json
#    "plugins": ["./dist/connector.js", "./dist/evaluators/availability-check.js"]

# 5. Launch
pnpm serve                       # starts API + Web UI

# The custom connector type appears in Settings → Connectors → Add → Type dropdown.
# The custom evaluators appear in Scenario form → Evaluators section.
# Create scenarios, attach evaluators, run evals — everything works through the UI.
```

For development iteration:

```bash
# Terminal 1: watch-compile plugins
pnpm dev

# Terminal 2: run evalstudio (reloads plugins on restart)
pnpm serve
```

---

### Alternative: Distributing as an npm Package

If the connector is useful across multiple eval projects, publish it as a standalone package:

```
evalstudio-booking-agent/
  package.json
  tsconfig.json
  src/
    index.ts                      ← default export: defineConnector({ ... })
  dist/
```

```json
{
  "name": "evalstudio-booking-agent",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "prepublishOnly": "pnpm build"
  },
  "peerDependencies": {
    "@evalstudio/core": ">=0.5.0"
  },
  "dependencies": {
    "@booking/agent-sdk": "^2.1.0"
  }
}
```

Consumers install and reference it by package name:

```bash
npm install evalstudio-booking-agent
```

```json
// evalstudio.config.json
{
  "plugins": ["evalstudio-booking-agent"]
}
```

Package names are resolved from the project's `node_modules` via dynamic `import()`. No path, no build step — just install and add to config.

---

## Design

### Plugin Interfaces

The full TypeScript interfaces for plugin authors are defined below. These are exported from `@evalstudio/core`.

#### ConnectorDefinition

```typescript
interface ConnectorDefinition {
  /** Unique type identifier, e.g. "booking-agent". Must not conflict with built-in types. */
  type: string;
  /** Human-readable label for the UI. */
  label: string;
  /** Optional description shown in the UI. */
  description?: string;
  /** JSON Schema describing the type-specific config fields. Used for validation and UI form generation. */
  configSchema?: JsonSchema;
  /** Invoke the connector with a conversation. Called by RunProcessor during run execution. */
  invoke(ctx: ConnectorContext): Promise<ConnectorInvokeResult>;
  /** Optional: test connectivity. If not provided, EvalStudio calls invoke() with a dummy message. */
  test?(ctx: ConnectorContext): Promise<ConnectorTestResult>;
}

interface ConnectorContext {
  connector: { baseUrl: string; headers?: Record<string, string>; config?: Record<string, unknown> };
  messages: Message[];
  run?: { id: string; threadId?: string; threadMessageCount?: number };
  extraHeaders?: Record<string, string>;
}
```

#### EvaluatorDefinition

```typescript
interface EvaluatorDefinition {
  /** Unique type identifier, e.g. "latency-budget". */
  type: string;
  /** Human-readable label for the UI. */
  label: string;
  /** Optional description. */
  description?: string;
  /** JSON Schema for evaluator-specific config. Stored on scenario.evaluators[].config. */
  configSchema?: JsonSchema;
  /** Evaluate a conversation turn. Called after each connector invocation. */
  evaluate(ctx: EvaluatorContext): Promise<EvaluationResult>;
}

interface EvaluatorContext {
  messages: Message[];
  config: Record<string, unknown>;
  scenario: { name: string; instructions?: string; maxMessages?: number };
  persona?: { name: string; description?: string };
  lastInvocation: { latencyMs: number; messages: Message[]; tokenUsage?: { input: number; output: number } };
  turn: number;
  isFinal: boolean;
}

interface EvaluationResult {
  success: boolean;
  score?: number;
  reason: string;
  metadata?: Record<string, unknown>;
}
```

#### Plugin Entry Point

A plugin's default export is an object with optional `connectors` and `evaluators` arrays:

```typescript
interface EvalStudioPlugin {
  connectors?: ConnectorDefinition[];
  evaluators?: EvaluatorDefinition[];
}
```

The `defineConnector()` and `defineEvaluator()` helpers are identity functions that wrap a single definition into this shape and provide type safety. A plugin can export multiple connectors and evaluators.

### Built-in Evaluators

EvalStudio ships with evaluators that cover common needs out of the box. These are registered in the same evaluator registry as plugin evaluators — no distinction from the user's perspective.

| Type | Label | Config | Description |
|------|-------|--------|-------------|
| `llm-judge` | LLM Judge | `successCriteria`, `failureCriteria`, `failureCriteriaMode` | The existing LLM-as-judge. Backwards-compatible: scenarios with `successCriteria`/`failureCriteria` fields automatically use this evaluator without adding it to the `evaluators` array. |
| `latency-budget` | Latency Budget | `maxMs: number` | Fails if any response exceeds a latency threshold. |
| `regex` | Regex Match | `pattern: string`, `flags?: string`, `mustMatch?: boolean` | Checks agent response against a regex pattern. `mustMatch` defaults to `true` (fail if no match). |
| `json-schema` | JSON Schema | `schema: object`, `onlyFinal?: boolean` | Validates agent response is JSON conforming to a schema. |
| `token-budget` | Token Budget | `maxTokens: number` | Fails if token usage exceeds a budget. |

Built-in evaluators live in `packages/core/src/evaluators/` and implement the same `EvaluatorDefinition` interface as plugin evaluators. They're registered at startup before plugins load.

### How Evaluators Attach to Scenarios

Currently, scenarios have flat `successCriteria` and `failureCriteria` strings for LLM-as-judge. The new `evaluators` array lets scenarios use any combination of built-in and plugin evaluators:

```typescript
interface Scenario {
  // ... existing fields ...

  // Existing — shorthand for the built-in llm-judge evaluator (backwards compat)
  successCriteria?: string;
  failureCriteria?: string;
  failureCriteriaMode?: FailureCriteriaMode;

  // New — built-in and/or plugin evaluators (run alongside LLM-as-judge if criteria also set)
  evaluators?: ScenarioEvaluator[];
}

interface ScenarioEvaluator {
  /** Evaluator type — references a built-in or plugin evaluator. */
  type: string;
  /** Type-specific config, validated against the evaluator's configSchema. */
  config?: Record<string, unknown>;
}
```

A scenario can use evaluators three ways:
- **Criteria only** (existing behavior): `successCriteria`/`failureCriteria` fields → LLM-as-judge runs, no `evaluators` array needed
- **Evaluators only**: `evaluators: [{ type: "latency-budget", config: { maxMs: 3000 } }]` → no LLM-as-judge, just the listed evaluators
- **Both**: Criteria fields + `evaluators` array → LLM-as-judge runs alongside the other evaluators

**Evaluation strategy: ALL must pass.** When a scenario has multiple evaluators (including implicit LLM-as-judge from criteria fields), all must agree for the run to succeed:

- If **any** evaluator returns `success: false`, the run fails (with the failing evaluator's reason)
- If **all** evaluators return `success: true`, the run succeeds
- Score is the minimum across all evaluators (conservative)

Existing scenarios with only `successCriteria`/`failureCriteria` work exactly as before — zero migration needed.

### How It Integrates with RunProcessor

The evaluation step in `executeEvaluationLoop` changes from:

```
invoke connector → evaluate criteria (LLM-as-judge) → check termination
```

To:

```
invoke connector → run all evaluators (LLM-as-judge + custom) → aggregate → check termination
```

1. **Build evaluator list**: LLM-as-judge (if criteria defined) + all evaluators from `scenario.evaluators[]`
2. **Run all evaluators in parallel** after each connector invocation
3. **Results are aggregated**: success = all passed, score = min(scores), reason = first failure reason (or combined)
4. **Termination logic unchanged**: same success/failure/maxMessages checks, but using aggregated result

### Run Output Extension

```typescript
// Existing output.evaluation stays for LLM-as-judge
run.output = {
  // ... existing fields ...
  evaluation: { /* LLM-as-judge result — unchanged */ },

  // New: per-evaluator results
  evaluatorResults?: Array<{
    type: string;
    label: string;
    success: boolean;
    score?: number;
    reason: string;
    metadata?: Record<string, unknown>;
  }>;
};
```

---

## Plugin Loading

### Discovery and Loading Flow

```
1. Read evalstudio.config.json → extract plugins[]
2. For each plugin entry:
   a. If starts with "." or "/" → resolve relative to config file
   b. Otherwise → resolve as npm package from project's node_modules
3. Dynamic import() each resolved path
4. Validate default export shape (must have connectors[] and/or evaluators[])
5. Register connector types and evaluator types in a PluginRegistry
6. Error on duplicate type names (across plugins and built-ins)
```

### PluginRegistry (Core)

```typescript
// packages/core/src/plugin.ts

interface PluginRegistry {
  /** Register a loaded plugin. Throws on duplicate types. */
  register(plugin: EvalStudioPlugin): void;

  /** Get a connector definition by type. Returns undefined if not found. */
  getConnector(type: string): ConnectorDefinition | undefined;

  /** Get an evaluator definition by type. Returns undefined if not found. */
  getEvaluator(type: string): EvaluatorDefinition | undefined;

  /** List all registered connector types (built-in + plugins). */
  listConnectorTypes(): Array<{ type: string; label: string; description?: string; configSchema?: JsonSchema; builtin: boolean }>;

  /** List all registered evaluator types (built-in + plugins). */
  listEvaluatorTypes(): Array<{ type: string; label: string; description?: string; configSchema?: JsonSchema; builtin: boolean }>;
}

/** Load all plugins from config and return a populated registry. */
function loadPlugins(configPath: string): Promise<PluginRegistry>;
```

### Error Handling

- **Plugin not found**: Clear error with the plugin name and resolution path tried. E.g., `Plugin "evalstudio-my-agent" not found. Run "npm install evalstudio-my-agent" in your project directory.`
- **Invalid export**: `Plugin "evalstudio-my-agent" has an invalid default export. Expected { connectors?: [...], evaluators?: [...] }.`
- **Duplicate type**: `Connector type "http" is already registered (built-in). Plugin "my-plugin" cannot override it.`
- **Runtime invoke error**: Wrapped and stored as `run.error` with the plugin name in the message. Run status set to "error".

---

## API Changes

### New Endpoints

- `GET /api/plugins` — List loaded plugins and their connector/evaluator types
- `GET /api/evaluator-types` — List available evaluator types (for scenario form)

### Modified Endpoints

- `GET /api/connectors/types` — Now includes plugin connector types alongside built-in types. Response shape adds `configSchema` and `builtin` fields:
  ```json
  [
    { "type": "http", "label": "HTTP", "builtin": true },
    { "type": "langgraph", "label": "LangGraph", "builtin": true },
    { "type": "my-agent", "label": "My Agent", "description": "...", "configSchema": { ... }, "builtin": false }
  ]
  ```

- `POST /api/connectors` and `PUT /api/connectors/{id}` — Accept any registered connector type (not just "http" | "langgraph"). Validate `config` against the type's `configSchema` if present.

- `POST /api/scenarios` and `PUT /api/scenarios/{id}` — Accept `evaluators` array. Validate each evaluator type exists and config matches schema.

---

## Web UI Changes

### Connector Form

- Type dropdown populated from `GET /api/connectors/types` (already fetched, just add plugin types)
- When a plugin type is selected, render config form from `configSchema` using a generic JSON Schema form renderer
- Built-in types keep their existing hardcoded forms (no regression)

### Scenario Form

- New "Evaluators" section below success/failure criteria
- "Add Evaluator" button → dropdown of available evaluator types from `GET /api/evaluator-types`
- Each added evaluator shows its label and a config form generated from `configSchema`
- Evaluators are optional — existing scenarios work unchanged

### Run Detail Page

- If `output.evaluatorResults` exists, show a collapsible "Evaluator Results" section
- Each evaluator result shows: type label, pass/fail badge, score, reason, and expandable metadata

---

## Core Package Changes

### New Files

- `packages/core/src/plugin.ts` — PluginRegistry, loadPlugins(), defineConnector(), defineEvaluator(), type definitions

### Modified Files

- `packages/core/src/connector.ts`:
  - `ConnectorType` becomes `string` (no longer a union)
  - `getConnectorTypes()` queries the PluginRegistry
  - `invoke()` checks built-in strategies first, then falls back to PluginRegistry
  - `test()` same fallback logic

- `packages/core/src/evaluator.ts`:
  - New `runEvaluators()` function that runs all evaluators (built-in + plugin) and aggregates results
  - Existing `evaluateCriteria()` becomes the `llm-judge` built-in evaluator internally

- `packages/core/src/evaluators/` (new directory):
  - Built-in evaluator implementations: `llm-judge.ts`, `latency-budget.ts`, `regex.ts`, `json-schema.ts`, `token-budget.ts`
  - Each implements `EvaluatorDefinition` — same interface as plugins

- `packages/core/src/run-processor.ts`:
  - Load PluginRegistry at processor start
  - Pass registry to evaluation step
  - Call `runEvaluators()` instead of `evaluateCriteria()` directly
  - Store `evaluatorResults` in run output

- `packages/core/src/scenario.ts`:
  - Add `evaluators` field to Scenario interface and CreateInput/UpdateInput
  - Validate evaluator types exist on create/update

- `packages/core/src/project.ts`:
  - Add `plugins` field to ProjectConfig interface
  - Read/write plugins array from config

- `packages/core/src/index.ts`:
  - Export new types and functions: `defineConnector`, `defineEvaluator`, `ConnectorDefinition`, `EvaluatorDefinition`, `ConnectorContext`, `EvaluatorContext`, `EvaluationResult`, `PluginRegistry`, `loadPlugins`

### Exports for Plugin Authors

The `@evalstudio/core` package exports everything a plugin author needs:

```typescript
// What plugin authors import
import {
  defineConnector,
  defineEvaluator,
  type ConnectorDefinition,
  type ConnectorContext,
  type ConnectorInvokeResult,
  type ConnectorTestResult,
  type EvaluatorDefinition,
  type EvaluatorContext,
  type EvaluationResult,
  type Message,
} from "@evalstudio/core";
```

---

## Out of Scope

- **Plugin marketplace / discovery** — Plugins are installed manually via npm. No registry or search.
- **Plugin lifecycle hooks** — No `onStart`, `onStop`, `onRunStart` hooks. Plugins are stateless invoke/evaluate functions.
- **Plugin-provided UI components** — Config forms are auto-generated from JSON Schema only. No custom React components from plugins.
- **Plugin versioning / compatibility checks** — Rely on npm peer dependency semver for now.

## Migration

- **Zero breaking changes.** The `plugins` field in config is optional and defaults to `[]`. Existing connector types ("http", "langgraph") remain built-in. Existing scenarios with only `successCriteria`/`failureCriteria` work unchanged. The `evaluators` field on Scenario is optional.
- **ConnectorType widening**: `ConnectorType` changes from `"http" | "langgraph"` to `string`. This is a widening change — existing code that checks `type === "http"` still works. TypeScript users of the core package may need to adjust type narrowing, but this is unlikely in practice.

## Implementation Order

1. **Plugin infrastructure** — `plugin.ts` with registry, loading, defineConnector/defineEvaluator helpers
2. **Built-in evaluators** — Extract LLM-as-judge into `EvaluatorDefinition`, implement latency-budget, regex, json-schema, token-budget
3. **Evaluator integration** — Add `evaluators` to Scenario, `runEvaluators()` aggregation, RunProcessor changes
4. **Connector plugin integration** — Widen ConnectorType, wire invoke/test to registry fallback
5. **API updates** — New endpoints, validation, schema in responses
6. **Web UI** — JSON Schema form renderer, evaluator section in scenario form, evaluator results in run detail
7. **Documentation and examples** — Guide for creating connector and evaluator plugins
