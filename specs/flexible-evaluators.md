# Spec: Flexible Evaluator Structure

## Summary

Replace the flat `successCriteria`/`failureCriteria` strings with a structured `evaluators` array on scenarios. Ship built-in evaluators that cover common needs: LLM-as-judge, latency budget, regex matching, JSON schema validation, and token budget. Multiple evaluators can run on each turn, with results aggregated (all must pass for the run to succeed).

## Motivation

Today, scenarios can only use LLM-as-judge via `successCriteria` and `failureCriteria` strings. This is powerful but limited:

- **No deterministic checks** — Can't enforce hard constraints like "response < 3s" or "matches pattern X"
- **Single evaluation method** — Can't combine LLM judgment with schema validation or other checks
- **Hard to extend** — Adding new evaluation types requires changing core interfaces

Teams need:
- **Latency thresholds** — "Response must be under 5 seconds"
- **Token budgets** — "Must not exceed 1000 tokens per response"
- **Format validation** — "Response must be valid JSON matching this schema"
- **Pattern matching** — "Must include a booking reference like BK-12345"
- **Combinations** — "LLM says success AND latency < 3s AND valid JSON"

## Current State

```typescript
interface Scenario {
  id: string;
  name: string;
  successCriteria?: string;      // Natural language for LLM
  failureCriteria?: string;       // Natural language for LLM
  failureCriteriaMode?: "every_turn" | "on_max_messages";
  // ...
}
```

Evaluation in RunProcessor:
1. Invoke connector
2. Call `evaluateCriteria()` with success/fail criteria strings
3. Get single result: `{ successMet, failureMet, confidence, reasoning }`
4. Check termination (success → done, failure + early exit → done, max messages → done)

Limitations:
- Only LLM-based evaluation
- No way to add latency checks, format validation, etc.
- Result is boolean + reasoning, no structured metadata

---

## Proposed Design

### New Scenario Structure

```typescript
interface Scenario {
  id: string;
  name: string;

  // DEPRECATED but supported for backwards compat
  successCriteria?: string;
  failureCriteria?: string;
  failureCriteriaMode?: "every_turn" | "on_max_messages";

  // NEW: structured evaluators
  evaluators?: ScenarioEvaluator[];

  // ... other fields ...
}

interface ScenarioEvaluator {
  type: string;                      // "llm-judge", "latency-budget", "regex", etc.
  config: Record<string, unknown>;   // Type-specific config
}
```

### Migration Path

Existing scenarios with `successCriteria`/`failureCriteria` work unchanged:
- If a scenario has criteria fields but no `evaluators` array → implicitly use `llm-judge` evaluator with those criteria
- If a scenario has `evaluators` array → use only those evaluators (criteria fields ignored if present)
- If a scenario has both → `evaluators` takes precedence (explicit over implicit)

This means:
- **Zero breaking changes** — all existing scenarios work as-is
- **Gradual migration** — teams can switch to `evaluators[]` when ready
- **Clear semantics** — explicit evaluators override implicit LLM-judge

### Evaluator Interface

All evaluators (built-in or future plugins) implement this interface:

```typescript
interface EvaluatorDefinition {
  type: string;
  label: string;
  description?: string;

  /** Is this evaluator an assertion (pass/fail gate) or a metric (just a measurement)? */
  kind: "assertion" | "metric";

  /** JSON Schema for this evaluator's config. Used for validation and UI forms. */
  configSchema: JsonSchema;

  /** Run evaluation on a conversation turn. */
  evaluate(ctx: EvaluatorContext): Promise<EvaluationResult>;
}

interface EvaluatorContext {
  messages: Message[];                // Full conversation history
  config: Record<string, unknown>;    // Evaluator config from scenario
  scenario: {
    name: string;
    instructions?: string;
    maxMessages?: number;
  };
  persona?: {
    name: string;
    description?: string;
  };
  lastInvocation: {
    latencyMs: number;
    messages: Message[];              // Messages from latest connector response
    tokenUsage?: { input: number; output: number };
  };
  turn: number;                       // 1-indexed turn number
  isFinal: boolean;                   // True if this is the last turn (max messages or early exit)
}

interface EvaluationResult {
  /** Pass/fail result. Only meaningful for assertions. Metrics always return true. */
  success: boolean;

  /** Numeric value. For metrics: the measured value. For assertions: optional 0-1 score. */
  value?: number;

  /** Human-readable explanation. For metrics: what was measured. For assertions: why it passed/failed. */
  reason: string;

  /** Structured data for debugging/analysis. */
  metadata?: Record<string, unknown>;
}
```

**Key distinction:**
- **Assertions** (`kind: "assertion"`) are pass/fail gates. `success: false` causes the run to fail.
- **Metrics** (`kind: "metric"`) are measurements. They always return `success: true` and store their value in `value`. They don't affect run success/failure.

Examples:
- `llm-judge`, `latency-budget`, `regex`, `json-schema` → **assertions**
- `tool-call-count`, `response-length`, `token-usage` → **metrics**

---

## Built-in Evaluators

### Assertions (Pass/Fail Gates)

These evaluators can cause a run to fail if their condition is not met.

#### 1. LLM Judge (`llm-judge`)

**Kind:** `assertion`

The existing LLM-as-judge, extracted into the evaluator interface.

**Config:**
```typescript
{
  successCriteria?: string;
  failureCriteria?: string;
  failureCriteriaMode?: "every_turn" | "on_max_messages";
}
```

**Behavior:**
- Formats conversation as "User: ... / Agent: ..."
- Sends to LLM with evaluation instructions
- Parses JSON response: `{ successMet, failureMet, confidence, reasoning }`
- Returns `success: successMet && !failureMet` (or just `successMet` if no fail criteria)

**Implementation:** Wraps existing `evaluateCriteria()` function.

---

#### 2. Latency Budget (`latency-budget`)

**Kind:** `assertion`

Fails if response time exceeds a threshold.

**Config:**
```typescript
{
  maxMs: number;                      // Required: max response time in milliseconds
}
```

**Behavior:**
```typescript
async evaluate(ctx) {
  const { maxMs } = ctx.config as { maxMs: number };
  const actual = ctx.lastInvocation.latencyMs;

  if (actual > maxMs) {
    return {
      success: false,
      score: Math.max(0, 1 - (actual - maxMs) / maxMs),
      reason: `Response took ${actual}ms, exceeding budget of ${maxMs}ms`,
      metadata: { actualMs: actual, budgetMs: maxMs },
    };
  }

  return {
    success: true,
    score: 1,
    reason: `Response within budget: ${actual}ms / ${maxMs}ms`,
  };
}
```

---

#### 3. Regex Match (`regex`)

**Kind:** `assertion`

Validates agent response against a regex pattern.

**Config:**
```typescript
{
  pattern: string;                    // Required: regex pattern
  flags?: string;                     // Optional: regex flags (e.g., "i", "g")
  mustMatch?: boolean;                // Default true: fail if no match. False: fail if match found.
}
```

**Behavior:**
```typescript
async evaluate(ctx) {
  const { pattern, flags, mustMatch = true } = ctx.config as {
    pattern: string;
    flags?: string;
    mustMatch?: boolean;
  };

  const lastAssistant = ctx.lastInvocation.messages.find(m => m.role === "assistant");
  if (!lastAssistant) {
    return { success: false, reason: "No assistant message found" };
  }

  const content = typeof lastAssistant.content === "string"
    ? lastAssistant.content
    : lastAssistant.content.map(b => (b as any).text ?? "").join("");

  const regex = new RegExp(pattern, flags);
  const match = regex.test(content);

  if (mustMatch && !match) {
    return { success: false, reason: `Response does not match pattern: ${pattern}` };
  }

  if (!mustMatch && match) {
    return { success: false, reason: `Response matches forbidden pattern: ${pattern}` };
  }

  return {
    success: true,
    reason: mustMatch
      ? `Response matches pattern: ${pattern}`
      : `Response does not match forbidden pattern: ${pattern}`,
  };
}
```

---

#### 4. JSON Schema (`json-schema`)

**Kind:** `assertion`

Validates that the agent's response is valid JSON conforming to a schema.

**Config:**
```typescript
{
  schema: object;                     // Required: JSON Schema object
  onlyFinal?: boolean;                // Default false: validate every turn or only the final turn
}
```

**Behavior:**
```typescript
import Ajv from "ajv";

async evaluate(ctx) {
  const { schema, onlyFinal = false } = ctx.config as {
    schema: Record<string, unknown>;
    onlyFinal?: boolean;
  };

  if (onlyFinal && !ctx.isFinal) {
    return { success: true, reason: "Skipped (not final turn)" };
  }

  const lastAssistant = ctx.lastInvocation.messages.find(m => m.role === "assistant");
  if (!lastAssistant) {
    return { success: false, reason: "No assistant message found" };
  }

  const content = typeof lastAssistant.content === "string"
    ? lastAssistant.content
    : "";

  try {
    const parsed = JSON.parse(content);
    const ajv = new Ajv();
    const validate = ajv.compile(schema);

    if (validate(parsed)) {
      return { success: true, score: 1, reason: "Response matches JSON schema" };
    }

    return {
      success: false,
      score: 0,
      reason: `Schema validation failed: ${ajv.errorsText(validate.errors)}`,
      metadata: { errors: validate.errors },
    };
  } catch (err) {
    return {
      success: false,
      score: 0,
      reason: `Response is not valid JSON: ${(err as Error).message}`,
    };
  }
}
```

**Dependencies:** Adds `ajv` to `@evalstudio/core` dependencies.

---

#### 5. Token Budget (`token-budget`)

**Kind:** `assertion`

Fails if token usage exceeds a limit.

**Config:**
```typescript
{
  maxTokens: number;                  // Required: max total tokens (input + output)
  inputOnly?: boolean;                // Default false: count only input tokens
  outputOnly?: boolean;               // Default false: count only output tokens
}
```

**Behavior:**
```typescript
async evaluate(ctx) {
  const { maxTokens, inputOnly = false, outputOnly = false } = ctx.config as {
    maxTokens: number;
    inputOnly?: boolean;
    outputOnly?: boolean;
  };

  const usage = ctx.lastInvocation.tokenUsage;
  if (!usage) {
    return { success: true, reason: "No token usage data available" };
  }

  let actual: number;
  if (inputOnly) {
    actual = usage.input;
  } else if (outputOnly) {
    actual = usage.output;
  } else {
    actual = usage.input + usage.output;
  }

  if (actual > maxTokens) {
    return {
      success: false,
      score: Math.max(0, 1 - (actual - maxTokens) / maxTokens),
      reason: `Token usage ${actual} exceeds budget of ${maxTokens}`,
      metadata: { actualTokens: actual, budgetTokens: maxTokens, usage },
    };
  }

  return {
    success: true,
    score: 1,
    reason: `Token usage within budget: ${actual} / ${maxTokens}`,
  };
}
```

---

### Metrics (Measurements)

These evaluators track values but don't cause runs to fail. They always return `success: true` and store their measurement in `value`.

#### 6. Tool Call Count (`tool-call-count`)

**Kind:** `metric`

Counts the number of tool calls in the agent's response.

**Config:**
```typescript
{}  // No config needed
```

**Behavior:**
```typescript
async evaluate(ctx) {
  let toolCallCount = 0;
  for (const msg of ctx.lastInvocation.messages) {
    if (msg.role === "assistant" && msg.tool_calls) {
      toolCallCount += msg.tool_calls.length;
    }
  }

  return {
    success: true,  // Metrics never fail
    value: toolCallCount,
    reason: `${toolCallCount} tool call(s) in this turn`,
    metadata: { toolCallCount },
  };
}
```

---

#### 7. Response Length (`response-length`)

**Kind:** `metric`

Measures the character length of the agent's response.

**Config:**
```typescript
{
  unit?: "characters" | "words";     // Default: "characters"
}
```

**Behavior:**
```typescript
async evaluate(ctx) {
  const { unit = "characters" } = ctx.config as { unit?: "characters" | "words" };

  const lastAssistant = ctx.lastInvocation.messages.find(m => m.role === "assistant");
  if (!lastAssistant) {
    return { success: true, value: 0, reason: "No assistant message found" };
  }

  const content = typeof lastAssistant.content === "string"
    ? lastAssistant.content
    : lastAssistant.content.map(b => (b as any).text ?? "").join("");

  let value: number;
  if (unit === "words") {
    value = content.split(/\s+/).filter(w => w.length > 0).length;
  } else {
    value = content.length;
  }

  return {
    success: true,
    value,
    reason: `Response length: ${value} ${unit}`,
    metadata: { length: value, unit },
  };
}
```

---

#### 8. Token Usage (`token-usage`)

**Kind:** `metric`

Tracks token usage (input and/or output).

**Config:**
```typescript
{
  track?: "total" | "input" | "output";  // Default: "total"
}
```

**Behavior:**
```typescript
async evaluate(ctx) {
  const { track = "total" } = ctx.config as { track?: "total" | "input" | "output" };

  const usage = ctx.lastInvocation.tokenUsage;
  if (!usage) {
    return { success: true, value: 0, reason: "No token usage data available" };
  }

  let value: number;
  if (track === "input") {
    value = usage.input;
  } else if (track === "output") {
    value = usage.output;
  } else {
    value = usage.input + usage.output;
  }

  return {
    success: true,
    value,
    reason: `Token usage (${track}): ${value}`,
    metadata: { ...usage, tracked: track },
  };
}
```

---

## Evaluation Strategy

When a scenario has multiple evaluators, **all assertions must pass** for the run to succeed. Metrics are tracked but never cause failure.

```typescript
interface AggregatedEvaluationResult {
  success: boolean;                   // True if ALL assertions passed
  score: number;                      // Minimum score across all assertions
  reason: string;                     // Combined reason (or first assertion failure reason)
  evaluatorResults: Array<{
    type: string;
    label: string;
    kind: "assertion" | "metric";
    success: boolean;                 // Always true for metrics
    value?: number;                   // For metrics: measured value. For assertions: optional 0-1 score.
    reason: string;
    metadata?: Record<string, unknown>;
  }>;
  metrics: Record<string, number>;    // Quick lookup: { "tool-call-count": 3, "response-length": 142, ... }
}
```

Aggregation logic:
1. Run all evaluators (assertions + metrics) in parallel
2. Separate results by `kind`:
   - **Assertions**: Check if all returned `success: true`
   - **Metrics**: Extract `value` and populate `metrics` object
3. `success = all assertions passed` (metrics ignored for pass/fail)
4. `score = min(assertion scores)` (conservative scoring, metrics excluded)
5. `reason = first assertion failure reason if any, else "All evaluators passed"`
6. Store per-evaluator results in `evaluatorResults[]` for debugging
7. Store metric values in `metrics` object for quick access

**Example:**
- Assertions: `llm-judge` (passed), `latency-budget` (passed)
- Metrics: `tool-call-count` (value: 3), `response-length` (value: 142)
- Result: `success: true`, `metrics: { "tool-call-count": 3, "response-length": 142 }`

---

## RunProcessor Changes

### Current Flow

```
1. Build messages (system prompt + seed + input + persona)
2. Loop while messages < maxMessages:
   a. Invoke connector
   b. Add response messages
   c. evaluateCriteria(successCriteria, failureCriteria)
   d. Check termination (success, failure, maxMessages)
   e. Generate next persona message if continuing
3. Store run with output.evaluation
```

### New Flow

```
1. Build messages (system prompt + seed + input + persona)
2. Build evaluator list:
   - If scenario.evaluators exists → use those
   - Else if successCriteria/failureCriteria → implicit llm-judge evaluator
   - Else → error (scenario must have evaluation criteria)
3. Loop while messages < maxMessages:
   a. Invoke connector
   b. Add response messages
   c. runEvaluators(evaluatorList, context) → AggregatedEvaluationResult
   d. Check termination (success, failure, maxMessages)
   e. Generate next persona message if continuing
4. Store run with output.evaluation (for backwards compat) AND output.evaluatorResults
```

---

## Data Model Changes

### Scenario

```typescript
interface Scenario {
  // ... existing fields ...

  // DEPRECATED (but supported)
  successCriteria?: string;
  failureCriteria?: string;
  failureCriteriaMode?: "every_turn" | "on_max_messages";

  // NEW
  evaluators?: ScenarioEvaluator[];
}

interface ScenarioEvaluator {
  type: string;
  config: Record<string, unknown>;
}
```

### Run Output

```typescript
interface Run {
  // ... existing fields ...

  output?: {
    // ... existing fields (avgLatencyMs, totalLatencyMs, etc.) ...

    // EXISTING (for backwards compat) — populated with llm-judge result if present
    evaluation?: {
      successMet: boolean;
      failureMet: boolean;
      confidence: number;
      reasoning: string;
    };

    // NEW — per-evaluator results
    evaluatorResults?: Array<{
      type: string;
      label: string;
      kind: "assertion" | "metric";
      success: boolean;               // Always true for metrics
      value?: number;                 // For metrics: measured value. For assertions: optional score.
      reason: string;
      metadata?: Record<string, unknown>;
    }>;

    // NEW — quick metric lookup
    metrics?: Record<string, number>; // e.g. { "tool-call-count": 3, "response-length": 142 }
  };
}
```

---

## API Changes

### New Endpoint

**`GET /api/evaluator-types`** — List available evaluator types

Response:
```json
[
  {
    "type": "llm-judge",
    "label": "LLM Judge",
    "kind": "assertion",
    "description": "Uses an LLM to evaluate responses against natural language criteria",
    "configSchema": { /* JSON Schema */ }
  },
  {
    "type": "latency-budget",
    "label": "Latency Budget",
    "kind": "assertion",
    "description": "Fails if response time exceeds a threshold",
    "configSchema": { /* JSON Schema */ }
  },
  {
    "type": "tool-call-count",
    "label": "Tool Call Count",
    "kind": "metric",
    "description": "Counts the number of tool calls in the agent's response",
    "configSchema": { /* JSON Schema */ }
  }
  // ... other evaluators
]
```

### Modified Endpoints

**`POST /api/scenarios`** and **`PUT /api/scenarios/{id}`**
- Accept `evaluators` array
- Validate each evaluator's `type` exists
- Validate each evaluator's `config` against its `configSchema`

---

## Web UI Changes

### Scenario Form

**Current:**
- Text area for "Success Criteria"
- Text area for "Failure Criteria"
- Dropdown for "Failure Criteria Mode"

**New:**
- Keep existing fields (for backwards compat) OR
- "Evaluators" section:
  - "Add Evaluator" button → dropdown of available evaluator types (from `GET /api/evaluator-types`), grouped by kind:
    - **Assertions** (pass/fail gates)
    - **Metrics** (measurements)
  - Each added evaluator shows:
    - Type label + description + kind badge (Assertion / Metric)
    - Auto-generated form from `configSchema` (JSON Schema → React form)
    - Remove button
  - Evaluators are optional (but at least one evaluation method required — either criteria or evaluators)

**Migration UX:**
- Show a banner: "Success/Failure Criteria are deprecated. Migrate to Evaluators for more flexibility."
- "Migrate" button converts criteria to `evaluators: [{ type: "llm-judge", config: { successCriteria, failureCriteria } }]`

### Run Detail Page

**New Section: "Evaluator Results"**

Show two tables: Assertions and Metrics.

**Assertions:**

| Evaluator | Result | Score | Reason |
|-----------|--------|-------|--------|
| LLM Judge | ✅ Pass | 0.95 | Agent correctly offered alternative dates |
| Latency Budget | ✅ Pass | 1.0 | 1,234ms / 3,000ms |
| JSON Schema | ❌ Fail | 0.0 | Response is not valid JSON |

**Metrics:**

| Metric | Value | Reason |
|--------|-------|--------|
| Tool Call Count | 3 | 3 tool call(s) in this turn |
| Response Length | 142 | Response length: 142 characters |
| Token Usage | 856 | Token usage (total): 856 |

Each row expandable to show `metadata`.

Overall result badge at top: **Failed** (because JSON Schema assertion failed).

Metrics are displayed for informational purposes and don't affect pass/fail status.

---

## Core Package Changes

### New Files

- `packages/core/src/evaluators/` (directory)
  - **Assertions:**
    - `llm-judge.ts` — Extracts existing `evaluateCriteria()` logic
    - `latency-budget.ts`
    - `regex.ts`
    - `json-schema.ts`
    - `token-budget.ts`
  - **Metrics:**
    - `tool-call-count.ts`
    - `response-length.ts`
    - `token-usage.ts`
  - `index.ts` — Registry of built-in evaluators

### Modified Files

**`packages/core/src/evaluator.ts`:**
- Add `EvaluatorDefinition`, `EvaluatorContext`, `EvaluationResult` interfaces
- Add `runEvaluators(evaluators, context)` function
  - Runs all evaluators (assertions + metrics) in parallel via `Promise.all()`
  - Separates results by `kind`:
    - **Assertions**: Check if all returned `success: true`
    - **Metrics**: Extract `value` and populate `metrics` object
  - Aggregates assertion results (all pass, min score, first failure reason)
  - Returns `AggregatedEvaluationResult` with `metrics` object
- Keep `evaluateCriteria()` but mark as deprecated (used internally by `llm-judge` evaluator)

**`packages/core/src/run-processor.ts`:**
- Change evaluation step:
  - Build evaluator list from `scenario.evaluators` or implicit `llm-judge`
  - Call `runEvaluators()` instead of `evaluateCriteria()`
  - Store `output.evaluatorResults` and `output.metrics` in addition to `output.evaluation` (for backwards compat)

**`packages/core/src/scenario.ts`:**
- Add `evaluators?: ScenarioEvaluator[]` to `Scenario` interface
- Add to `CreateScenarioInput` and `UpdateScenarioInput`
- Validation:
  - If `evaluators` is set, validate each evaluator type exists and config matches schema
  - If neither `evaluators` nor `successCriteria`/`failureCriteria` is set, error: "Scenario must have evaluation criteria"

**`packages/core/src/index.ts`:**
- Export: `EvaluatorDefinition`, `EvaluatorContext`, `EvaluationResult`, `ScenarioEvaluator`
- Export: `getEvaluatorTypes()` function (lists built-in evaluators)

---

## Implementation Order

1. **Evaluator interfaces** — Add `EvaluatorDefinition` (with `kind` field), `EvaluatorContext`, `EvaluationResult` (with `value` field) to `evaluator.ts`
2. **Built-in evaluators** — Implement 5 assertions + 3 metrics in `packages/core/src/evaluators/`
3. **Registry** — `getEvaluatorTypes()` function that returns built-in evaluator metadata
4. **Aggregation** — `runEvaluators()` function that runs assertions + metrics, aggregates assertion results, extracts metric values
5. **Scenario changes** — Add `evaluators` field, update CRUD, add validation
6. **RunProcessor** — Switch from `evaluateCriteria()` to `runEvaluators()`, store per-evaluator results + metrics object
7. **API** — Add `GET /api/evaluator-types`, update scenario endpoints
8. **Web UI** — JSON Schema form renderer, evaluator section in scenario form (grouped by kind), separate tables for assertions and metrics in run detail
9. **Migration path** — Add banner + "Migrate" button to convert old criteria to new evaluators array

---

## Out of Scope

- **Custom evaluators** — No plugin system yet. Only built-in evaluators. (Separate proposal.)
- **Evaluator weights** — All evaluators are equal. No "this evaluator is more important."
- **Conditional evaluation** — Can't say "only run latency-budget if LLM-judge passes."
- **Evaluator composition** — Can't say "pass if (LLM-judge OR regex) AND latency-budget."
- **Per-evaluator termination** — Can't say "exit early if latency-budget fails, but keep going if regex fails."

These could be added later if needed.

---

## Migration

**Zero breaking changes:**
- Existing scenarios with `successCriteria`/`failureCriteria` continue to work unchanged
- RunProcessor implicitly converts them to an `llm-judge` evaluator at runtime
- `output.evaluation` field is preserved for backwards compatibility
- Web UI shows both old (criteria) and new (evaluators) forms, with a migration path

**Gradual adoption:**
- Teams can start using `evaluators[]` for new scenarios immediately
- Existing scenarios can be migrated at leisure via the "Migrate" button in the UI
- Both old and new formats work side-by-side

---

## Example Scenarios

### Scenario 1: LLM-only (existing behavior)

```json
{
  "name": "Booking Assistant - Happy Path",
  "successCriteria": "The agent successfully books an appointment and provides a confirmation number",
  "failureCriteria": "The agent gives up or says booking is not possible"
}
```

**Evaluation:** Implicitly uses `llm-judge` evaluator.

---

### Scenario 2: LLM + Latency

```json
{
  "name": "Booking Assistant - Performance",
  "evaluators": [
    {
      "type": "llm-judge",
      "config": {
        "successCriteria": "The agent successfully books an appointment",
        "failureCriteria": "The agent gives up or errors"
      }
    },
    {
      "type": "latency-budget",
      "config": { "maxMs": 3000 }
    }
  ]
}
```

**Evaluation:** Both must pass. If LLM says success but latency is 4s, the run fails.

---

### Scenario 3: Format Validation Only

```json
{
  "name": "Availability Query - JSON Output",
  "evaluators": [
    {
      "type": "json-schema",
      "config": {
        "schema": {
          "type": "object",
          "properties": {
            "available": { "type": "boolean" },
            "slots": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "date": { "type": "string", "format": "date" },
                  "time": { "type": "string", "pattern": "^\\d{2}:\\d{2}$" }
                },
                "required": ["date", "time"]
              }
            }
          },
          "required": ["available", "slots"]
        },
        "onlyFinal": true
      }
    }
  ]
}
```

**Evaluation:** No LLM judge. Only validates final response is JSON matching schema.

---

### Scenario 4: Assertions + Metrics

```json
{
  "name": "Booking Assistant - Full Validation + Tracking",
  "evaluators": [
    {
      "type": "llm-judge",
      "config": {
        "successCriteria": "Agent books an appointment and confirms with the user",
        "failureCriteria": "Agent gives up or says no appointments available"
      }
    },
    {
      "type": "latency-budget",
      "config": { "maxMs": 5000 }
    },
    {
      "type": "regex",
      "config": {
        "pattern": "BK-\\d{5}",
        "mustMatch": true
      }
    },
    {
      "type": "tool-call-count",
      "config": {}
    },
    {
      "type": "response-length",
      "config": { "unit": "words" }
    },
    {
      "type": "token-usage",
      "config": { "track": "total" }
    }
  ]
}
```

**Evaluation:**
- **Assertions** (must pass): LLM judge + latency budget + regex
- **Metrics** (tracked): tool call count, response length (words), token usage
- Run succeeds if all assertions pass. Metrics are tracked regardless of pass/fail.

**Example output:**
```json
{
  "success": true,
  "score": 0.95,
  "reason": "All evaluators passed",
  "metrics": {
    "tool-call-count": 2,
    "response-length": 47,
    "token-usage": 856
  }
}
```
