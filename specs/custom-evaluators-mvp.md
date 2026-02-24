# Spec: Custom Evaluators MVP

## Summary

Add a custom evaluator framework to EvalStudio. Users define evaluators as local TypeScript/JavaScript files that implement a simple interface. Evaluators can be **assertions** (pass/fail gates) or **metrics** (measurements that don't affect pass/fail). They attach to scenarios via an `evaluators[]` array and run after each connector invocation alongside the existing LLM-as-judge.

Ship `tool-call-count` as the first built-in metric to prove out the framework.

## Motivation

Today, evaluation is limited to LLM-as-judge via `successCriteria`/`failureCriteria`. Teams need to track additional signals — tool call counts, custom business logic, domain-specific checks — without being limited to natural language judgment.

The goal is a minimal framework that:
1. Lets anyone write an evaluator in a few lines of code
2. Supports both pass/fail checks (assertions) and passive tracking (metrics)
3. Runs custom evaluators alongside the existing LLM-as-judge
4. Stores per-evaluator results for analysis

Everything else — built-in evaluator library (latency-budget, regex, json-schema, etc.), npm plugin distribution, migration UX from old criteria to new evaluators — is out of scope and can be added incrementally later.

---

## Evaluator Interface

All evaluators implement this interface, exported from `@evalstudio/core`:

```typescript
interface EvaluatorDefinition {
  /** Unique type identifier, e.g. "tool-call-count", "my-custom-check". */
  type: string;

  /** Human-readable label for the UI. */
  label: string;

  /** Optional description shown in the UI. */
  description?: string;

  /** Assertion = pass/fail gate. Metric = measurement only (never fails). */
  kind: "assertion" | "metric";

  /** JSON Schema for evaluator-specific config. Used for validation and UI form generation. */
  configSchema?: JsonSchema;

  /** Run evaluation on a conversation turn. Called after each connector invocation. */
  evaluate(ctx: EvaluatorContext): Promise<EvaluationResult>;
}
```

### EvaluatorContext

Everything an evaluator needs to inspect a conversation turn. Uses existing types from `@evalstudio/core` — no new shapes:

```typescript
import type { Message, TokensUsage } from "@evalstudio/core";

interface EvaluatorContext {
  /** Full conversation history (all messages so far). Uses the existing Message type. */
  messages: Message[];

  /** Evaluator config from the scenario's evaluators[] entry. */
  config: Record<string, unknown>;

  /** Scenario metadata. */
  scenario: {
    name: string;
    instructions?: string;
    maxMessages?: number;
  };

  /** Persona metadata, if present. */
  persona?: {
    name: string;
    description?: string;
  };

  /** Data from the most recent connector invocation. */
  lastInvocation: {
    /** Response time for this invocation (ms). */
    latencyMs: number;
    /** New messages returned by the connector in this turn. Same Message type — includes tool_calls, content blocks, etc. */
    messages: Message[];
    /** Token usage, if the connector provides it. Same TokensUsage type used by connectors and runs. */
    tokensUsage?: TokensUsage;
  };

  /** 1-indexed turn number. */
  turn: number;

  /** True if this is the last turn (max messages reached or early exit). */
  isFinal: boolean;
}
```

**Types reused from existing codebase:**
- **`Message`** — OpenAI chat format with `role`, `content` (string | ContentBlock[] | null), `tool_calls?: ToolCall[]`, `tool_call_id?`, `name?`, `id?`, `metadata?`
- **`TokensUsage`** — `{ input_tokens: number; output_tokens: number; total_tokens: number }` — the same shape connectors produce and runs store
- **`ToolCall`** — `{ id: string; type: "function"; function: { name: string; arguments: string } }` — accessed via `Message.tool_calls`
- **`ContentBlock`** — `{ type: string; text?: string }` — for multi-part content, use `getMessageContentAsString()` helper to normalize

**Data availability note:** `lastInvocation.messages` includes `tool_calls` when the connector provides them (LangGraph does; others may not). `tokensUsage` is optional — connectors that don't track tokens omit it. Evaluators should handle missing data gracefully.

### EvaluationResult

```typescript
interface EvaluationResult {
  /** Pass/fail. Assertions: false = run fails. Metrics: always true. */
  success: boolean;

  /** Numeric value. Metrics: the measured value. Assertions: optional 0-1 score. */
  value?: number;

  /** Human-readable explanation. */
  reason: string;

  /** Structured data for debugging/analysis. */
  metadata?: Record<string, unknown>;
}
```

### Helpers

**`defineEvaluator()`** — Identity function that provides type safety and wraps the definition for plugin loading:

```typescript
function defineEvaluator(def: EvaluatorDefinition): { evaluators: EvaluatorDefinition[] } {
  return { evaluators: [def] };
}
```

The default export of an evaluator file is the return value of `defineEvaluator()`.

**`getMessageContentAsString()`** — Already exported from `@evalstudio/core`. Evaluators should use this to safely extract text from `Message.content` (which can be `string | ContentBlock[] | null`).

---

## Built-in Evaluator: tool-call-count

The first built-in evaluator, proving out the framework.

**Kind:** `metric`

**Config:** None required.

```typescript
// packages/core/src/evaluators/tool-call-count.ts
import { defineEvaluator } from "../evaluator-registry.js";
import type { ToolCall } from "../types.js";

export default defineEvaluator({
  type: "tool-call-count",
  label: "Tool Call Count",
  description: "Counts tool calls in the agent's response. Requires a connector that returns tool_calls in messages (e.g. LangGraph).",
  kind: "metric",
  configSchema: { type: "object", properties: {}, additionalProperties: false },

  async evaluate(ctx) {
    // Message.tool_calls is ToolCall[] | undefined — uses existing ToolCall type
    let count = 0;
    const toolNames: string[] = [];

    for (const msg of ctx.lastInvocation.messages) {
      if (msg.role === "assistant" && msg.tool_calls) {
        count += msg.tool_calls.length;
        for (const tc of msg.tool_calls) {
          toolNames.push(tc.function.name);
        }
      }
    }

    return {
      success: true,
      value: count,
      reason: count === 0
        ? "No tool calls in this turn"
        : `${count} tool call(s): ${toolNames.join(", ")}`,
      metadata: { toolCallCount: count, toolNames },
    };
  },
});
```

---

## Evaluator Registration

### evalstudio.config.json

A new optional `evaluators` array in the project config lists paths to custom evaluator files:

```json
{
  "version": 2,
  "name": "my-project",
  "evaluators": [
    "./dist/evaluators/my-custom-check.js"
  ],
  "llmSettings": { ... }
}
```

Paths starting with `./` or `/` are resolved relative to the config file. Package names (no prefix) are resolved from `node_modules` via `import()`.

Built-in evaluators (like `tool-call-count`) are always available and don't need to be listed.

### EvaluatorRegistry

A registry that holds all known evaluator types (built-in + custom):

```typescript
// packages/core/src/evaluator-registry.ts

class EvaluatorRegistry {
  private evaluators = new Map<string, EvaluatorDefinition>();

  /** Register an evaluator. Throws on duplicate type. */
  register(def: EvaluatorDefinition): void;

  /** Get an evaluator by type. Returns undefined if not found. */
  get(type: string): EvaluatorDefinition | undefined;

  /** List all registered evaluator types with metadata. */
  list(): Array<{
    type: string;
    label: string;
    description?: string;
    kind: "assertion" | "metric";
    configSchema?: JsonSchema;
    builtin: boolean;
  }>;
}

/** Create a registry with built-in evaluators pre-registered. */
function createEvaluatorRegistry(): EvaluatorRegistry;

/** Load custom evaluators from config and add to registry. */
async function loadCustomEvaluators(
  registry: EvaluatorRegistry,
  configPath: string
): Promise<void>;
```

### Loading Flow

```
1. createEvaluatorRegistry() → registers built-in evaluators (tool-call-count)
2. loadCustomEvaluators(registry, configPath):
   a. Read evalstudio.config.json → extract evaluators[]
   b. For each entry:
      - Resolve path (relative to config, or from node_modules)
      - Dynamic import()
      - Validate default export has { evaluators: EvaluatorDefinition[] }
      - Register each evaluator (throw on duplicate type)
3. Registry is ready — passed to RunProcessor and API
```

### Error Handling

- **File not found:** `Evaluator plugin "./dist/evaluators/foo.js" not found. Make sure you've built your project.`
- **Invalid export:** `Evaluator plugin "./dist/evaluators/foo.js" has an invalid export. Use defineEvaluator() to create the export.`
- **Duplicate type:** `Evaluator type "tool-call-count" is already registered. Custom evaluators cannot override built-in types.`
- **Runtime error in evaluate():** Caught, stored in evaluator result as `{ success: false, reason: "Evaluator error: <message>" }`.

---

## Scenario Changes

### Data Model

```typescript
interface Scenario {
  // ... existing fields ...

  // Existing — still works, drives LLM-as-judge as before
  successCriteria?: string;
  failureCriteria?: string;
  failureCriteriaMode?: FailureCriteriaMode;

  // NEW — additional evaluators that run alongside LLM-as-judge
  evaluators?: ScenarioEvaluator[];
}

interface ScenarioEvaluator {
  /** Evaluator type — references a registered evaluator. */
  type: string;
  /** Type-specific config, validated against the evaluator's configSchema. */
  config?: Record<string, unknown>;
}
```

### How criteria and evaluators interact

Both can coexist on a scenario:
- **Criteria only** (existing behavior): `successCriteria`/`failureCriteria` → LLM-as-judge runs as today. No changes.
- **Evaluators only**: Just the `evaluators[]` array → only those evaluators run. No LLM-as-judge.
- **Both**: Criteria fields + `evaluators[]` → LLM-as-judge runs alongside the listed evaluators. All must pass.

A scenario must have at least one evaluation method (criteria or evaluators). Having neither is a validation error.

### Validation

On scenario create/update, if `evaluators[]` is present:
- Each `type` must exist in the EvaluatorRegistry
- Each `config` must validate against the evaluator's `configSchema` (if the evaluator has one)

---

## RunProcessor Changes

### Current Flow

```
invoke connector → evaluateCriteria() → check termination
```

### New Flow

```
invoke connector → runEvaluators() → check termination
```

### runEvaluators()

New function in `evaluator.ts`:

```typescript
interface AggregatedEvaluationResult {
  /** True if all assertions passed. */
  success: boolean;

  /** Min score across assertions, or undefined if no assertions have scores. */
  score?: number;

  /** First assertion failure reason, or "All evaluators passed". */
  reason: string;

  /** Per-evaluator results. */
  evaluatorResults: Array<{
    type: string;
    label: string;
    kind: "assertion" | "metric";
    success: boolean;
    value?: number;
    reason: string;
    metadata?: Record<string, unknown>;
  }>;

  /** Quick metric lookup: { "tool-call-count": 3, ... } */
  metrics: Record<string, number>;
}

async function runEvaluators(
  evaluators: Array<{ definition: EvaluatorDefinition; config: Record<string, unknown> }>,
  context: Omit<EvaluatorContext, "config">
): Promise<AggregatedEvaluationResult>;
```

**Aggregation logic:**

1. Run all evaluators in parallel via `Promise.allSettled()`
2. For each result, wrap failures (rejected promises) as `{ success: false, reason: "Evaluator error: ..." }`
3. Separate results by `kind`:
   - **Assertions**: collect `success` and `value` (score)
   - **Metrics**: extract `value` into `metrics` map
4. `success = all assertions passed` (metrics ignored)
5. `score = min(assertion values)` where values exist
6. `reason = first assertion failure reason` or `"All evaluators passed"`

### Integration with RunProcessor

The `executeEvaluationLoop` method changes:

1. **At processor start**: Create the EvaluatorRegistry, load custom evaluators from config
2. **Per-run setup**: Build the evaluator list for the scenario:
   - If `scenario.evaluators` exists → resolve each type from registry
   - If `scenario.successCriteria` or `scenario.failureCriteria` exists → add implicit `llm-judge` (but `llm-judge` is NOT being extracted into the framework in this phase — see below)
3. **After each connector invocation**: Build `EvaluatorContext` from run state and call `runEvaluators()`
4. **Termination check**: Use `AggregatedEvaluationResult.success` for pass/fail

### LLM-as-Judge: NOT extracted yet

The existing `evaluateCriteria()` stays exactly as-is. It is NOT wrapped into an `EvaluatorDefinition` in this phase. Instead:

- If the scenario has criteria fields → `evaluateCriteria()` runs as today (unchanged code path)
- If the scenario also has `evaluators[]` → custom evaluators run in addition
- Final success = `evaluateCriteria() passed` AND `all custom assertions passed`
- If the scenario has ONLY `evaluators[]` (no criteria) → only custom evaluators run, `evaluateCriteria()` is skipped

This avoids refactoring the LLM-as-judge while still enabling the custom evaluator framework. Extracting `evaluateCriteria()` into an `llm-judge` evaluator is a natural follow-up but explicitly out of scope here.

---

## Run Output Changes

```typescript
interface Run {
  // ... existing fields ...
  output?: {
    // Existing (unchanged)
    avgLatencyMs?: number;
    totalLatencyMs?: number;
    messageCount?: number;
    maxMessagesReached?: boolean;
    evaluation?: {
      successMet: boolean;
      failureMet: boolean;
      confidence: number;
      reasoning: string;
    };

    // NEW — per-evaluator results (only present if evaluators[] was used)
    evaluatorResults?: Array<{
      type: string;
      label: string;
      kind: "assertion" | "metric";
      success: boolean;
      value?: number;
      reason: string;
      metadata?: Record<string, unknown>;
    }>;

    // NEW — quick metric lookup (only present if metrics were tracked)
    metrics?: Record<string, number>;
  };
}
```

The existing `output.evaluation` field continues to be populated by `evaluateCriteria()` when criteria fields are present. The new `evaluatorResults` and `metrics` fields are populated by `runEvaluators()` when `evaluators[]` is present.

---

## API Changes

### New Endpoint

**`GET /api/evaluator-types`**

Returns all registered evaluator types (built-in + custom):

```json
[
  {
    "type": "tool-call-count",
    "label": "Tool Call Count",
    "description": "Counts tool calls in the agent's response...",
    "kind": "metric",
    "configSchema": { "type": "object", "properties": {} },
    "builtin": true
  },
  {
    "type": "my-custom-check",
    "label": "My Custom Check",
    "description": "...",
    "kind": "assertion",
    "configSchema": { ... },
    "builtin": false
  }
]
```

### Modified Endpoints

**`POST /api/scenarios`** and **`PUT /api/scenarios/:id`**:
- Accept `evaluators` array in request body
- Validate each evaluator type exists in registry
- Validate each evaluator config against its configSchema

**`GET /api/runs/:id`**:
- Response already returns `output` as-is. The new `evaluatorResults` and `metrics` fields are included automatically.

---

## Web UI Changes

### Scenario Form

Add an "Evaluators" section below the existing criteria fields:

- **"Add Evaluator" button** → dropdown of available evaluator types from `GET /api/evaluator-types`, grouped by kind:
  - **Assertions** (pass/fail gates)
  - **Metrics** (measurements)
- Each added evaluator shows:
  - Type label + kind badge ("Assertion" / "Metric")
  - Description text
  - Config form auto-generated from `configSchema` (JSON Schema → form fields)
  - Remove button
- Evaluators are optional — the existing criteria fields still work as before

For `tool-call-count` specifically, the config form is empty (no config needed) — just the evaluator card with label, description, and kind badge.

### Run Detail Page

If `output.evaluatorResults` exists on a run, show a new **"Evaluator Results"** section in the run messages modal.

Two sub-sections:

**Assertions** (if any):

| Evaluator | Result | Score | Reason |
|-----------|--------|-------|--------|
| My Custom Check | Pass/Fail | 0.95 | ... |

**Metrics** (if any):

| Metric | Value | Reason |
|--------|-------|--------|
| Tool Call Count | 3 | 3 tool call(s) in this turn |

Each row expandable to show `metadata`.

If no `evaluatorResults` exist (old runs, criteria-only scenarios), this section is hidden.

---

## Core Package Changes

### New Files

- **`packages/core/src/evaluator-registry.ts`** — EvaluatorRegistry class, createEvaluatorRegistry(), loadCustomEvaluators()
- **`packages/core/src/evaluators/tool-call-count.ts`** — Built-in tool-call-count metric
- **`packages/core/src/evaluators/index.ts`** — Exports built-in evaluator list for registry initialization

### Modified Files

- **`packages/core/src/evaluator.ts`**:
  - Add `EvaluatorDefinition`, `EvaluatorContext`, `EvaluationResult`, `AggregatedEvaluationResult` interfaces
  - Add `runEvaluators()` function
  - Keep `evaluateCriteria()` unchanged

- **`packages/core/src/run-processor.ts`**:
  - Accept EvaluatorRegistry in constructor or as parameter
  - Build evaluator list from scenario.evaluators[]
  - Build EvaluatorContext from run state (messages, lastInvocation, turn, etc.)
  - Call `runEvaluators()` in addition to (or instead of) `evaluateCriteria()`
  - Store `evaluatorResults` and `metrics` in run output

- **`packages/core/src/scenario.ts`**:
  - Add `evaluators?: ScenarioEvaluator[]` to Scenario, CreateScenarioInput, UpdateScenarioInput
  - Add validation: evaluator types must exist, configs must match schemas

- **`packages/core/src/project.ts`**:
  - Add `evaluators?: string[]` to ProjectConfig interface
  - Read/write evaluators array from evalstudio.config.json

- **`packages/core/src/index.ts`**:
  - Export new types and functions: `EvaluatorDefinition`, `EvaluatorContext`, `EvaluationResult`, `ScenarioEvaluator`, `defineEvaluator`, `EvaluatorRegistry`, `createEvaluatorRegistry`, `loadCustomEvaluators`
  - Already exports `Message`, `TokensUsage`, `getMessageContentAsString` — no changes needed for those

### API Package

- **`packages/api/src/routes/evaluator-types.ts`** (new) — `GET /api/evaluator-types`
- **`packages/api/src/routes/scenarios.ts`** — Accept and validate `evaluators` field
- **`packages/api/src/index.ts`** — Initialize registry at server start, register route

### Web Package

- **`packages/web/src/components/EvaluatorForm.tsx`** (new) — Evaluator section for scenario form with add/remove/config
- **`packages/web/src/components/EvaluatorResults.tsx`** (new) — Evaluator results display for run detail
- **`packages/web/src/components/JsonSchemaForm.tsx`** (new) — Generic form renderer from JSON Schema (used by evaluator config)
- **Scenario form pages** — Integrate EvaluatorForm
- **Run detail modal** — Integrate EvaluatorResults

---

## Writing a Custom Evaluator

### Example: Response Contains Greeting (Assertion)

```typescript
// src/evaluators/greeting-check.ts
import { defineEvaluator, getMessageContentAsString } from "@evalstudio/core";

export default defineEvaluator({
  type: "greeting-check",
  label: "Greeting Check",
  description: "Verifies the agent greets the user in their first response",
  kind: "assertion",

  configSchema: {
    type: "object",
    properties: {
      greetings: {
        type: "array",
        items: { type: "string" },
        default: ["hello", "hi", "hey", "welcome"],
        description: "List of acceptable greeting words",
      },
    },
  },

  async evaluate(ctx) {
    // Only check on the first turn
    if (ctx.turn > 1) {
      return { success: true, reason: "Skipped (not first turn)" };
    }

    const greetings = (ctx.config.greetings as string[]) ?? ["hello", "hi", "hey", "welcome"];
    const lastAssistant = ctx.lastInvocation.messages.find(m => m.role === "assistant");

    if (!lastAssistant) {
      return { success: false, reason: "No assistant message found" };
    }

    // Use getMessageContentAsString() to handle string | ContentBlock[] | null
    const text = getMessageContentAsString(lastAssistant.content).toLowerCase();
    const found = greetings.find(g => text.includes(g));

    if (!found) {
      return {
        success: false,
        reason: `Response does not contain a greeting. Expected one of: ${greetings.join(", ")}`,
      };
    }

    return {
      success: true,
      reason: `Found greeting: "${found}"`,
    };
  },
});
```

### Registering It

```json
// evalstudio.config.json
{
  "evaluators": ["./dist/evaluators/greeting-check.js"]
}
```

### Using It on a Scenario

```json
{
  "name": "Welcome Flow",
  "successCriteria": "Agent helps the user book an appointment",
  "evaluators": [
    {
      "type": "greeting-check",
      "config": { "greetings": ["hello", "welcome", "good morning"] }
    },
    {
      "type": "tool-call-count",
      "config": {}
    }
  ]
}
```

This scenario runs three evaluations per turn:
1. **LLM-as-judge** (from `successCriteria`) — assertion
2. **greeting-check** (custom) — assertion
3. **tool-call-count** (built-in) — metric

Run passes if both assertions pass. Tool call count is tracked regardless.

---

## Implementation Order

1. **Evaluator interfaces** — Add types to `evaluator.ts` (`EvaluatorDefinition`, `EvaluatorContext`, `EvaluationResult`, `AggregatedEvaluationResult`, `ScenarioEvaluator`)
2. **defineEvaluator() helper** — Identity function for type safety
3. **EvaluatorRegistry** — Registry class with register/get/list, built-in registration
4. **tool-call-count** — First built-in evaluator in `evaluators/` directory
5. **runEvaluators()** — Aggregation function that runs evaluators in parallel and combines results
6. **Custom evaluator loading** — loadCustomEvaluators() reads config, dynamic imports, registers
7. **Scenario changes** — Add `evaluators` field to data model, update CRUD, add validation
8. **RunProcessor integration** — Build EvaluatorContext, call runEvaluators(), store results alongside existing evaluateCriteria()
9. **API** — `GET /api/evaluator-types` endpoint, update scenario endpoints
10. **Web UI** — JsonSchemaForm component, EvaluatorForm for scenario editing, EvaluatorResults for run detail

---

## Out of Scope

- **Extracting LLM-as-judge** into the evaluator framework (stays as `evaluateCriteria()`)
- **Other built-in evaluators** (latency-budget, regex, json-schema, token-budget, response-length, token-usage) — can be added incrementally later using the same framework
- **Migration UX** — No banner or "Migrate" button to convert criteria → evaluators
- **npm package distribution** — Custom evaluators are local files only (npm packages can be added later via the same `import()` mechanism)
- **Plugin lifecycle** — No onStart/onStop hooks
- **Evaluator composition** — No OR logic, no weights, no conditional evaluation
- **Per-evaluator termination** — All evaluators run every turn
- **Custom UI components** — Config forms are auto-generated from JSON Schema only
