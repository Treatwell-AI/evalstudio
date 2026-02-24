# Spec: Flexible Evaluators (Core Principles)

## Problem

Today, scenarios can only evaluate with LLM-as-judge via `successCriteria`/`failureCriteria` strings. This limits what teams can test:

- ❌ Can't enforce hard constraints like "response < 3s"
- ❌ Can't validate output format (JSON schema, regex patterns)
- ❌ Can't combine multiple checks (LLM says success AND latency < 3s)
- ❌ Can't track metrics without affecting pass/fail (tool calls, token usage)

## Proposal

Replace flat criteria strings with a structured `evaluators` array:

```typescript
interface Scenario {
  // OLD (deprecated but supported)
  successCriteria?: string;
  failureCriteria?: string;

  // NEW
  evaluators?: Array<{
    type: string;              // "llm-judge", "latency-budget", "regex", etc.
    config: Record<string, unknown>;
  }>;
}
```

## Two Types of Evaluators

### 1. Assertions (Pass/Fail Gates)

**Purpose:** Enforce requirements. Failure causes the run to fail.

**Examples:**
- `llm-judge` — Natural language criteria (existing LLM-as-judge)
- `latency-budget` — Response time must be under X ms
- `regex` — Response must match/not match a pattern
- `json-schema` — Response must be valid JSON matching a schema
- `token-budget` — Token usage must be under X

**Result:**
```typescript
{
  success: boolean;    // false → run fails
  value?: number;      // optional 0-1 score
  reason: string;
}
```

### 2. Metrics (Measurements)

**Purpose:** Track values for analysis. Never cause runs to fail.

**Examples:**
- `tool-call-count` — How many tool calls? (connector-specific: needs `tool_calls` in messages)
- `response-length` — Character/word count (universal: works with any connector)
- `token-usage` — Track input/output/total tokens (connector-specific: only if connector returns token data)

**Result:**
```typescript
{
  success: true;       // always true (metrics never fail)
  value: number;       // the measured value
  reason: string;
}
```

## Evaluation Strategy

**All assertions must pass.** Metrics are tracked regardless.

```typescript
// Run output
{
  success: boolean;                    // true if all assertions passed
  evaluatorResults: Array<{            // detailed per-evaluator results
    type: string;
    kind: "assertion" | "metric";
    success: boolean;
    value?: number;
    reason: string;
  }>;
  metrics: Record<string, number>;     // quick lookup: { "tool-call-count": 3 }
}
```

## Example Scenario

```json
{
  "name": "Booking Flow",
  "evaluators": [
    // Assertions (must pass)
    {
      "type": "llm-judge",
      "config": {
        "successCriteria": "Agent successfully books appointment"
      }
    },
    {
      "type": "latency-budget",
      "config": { "maxMs": 3000 }
    },
    {
      "type": "regex",
      "config": {
        "pattern": "BK-\\d{5}",
        "mustMatch": true
      }
    },

    // Metrics (tracked)
    {
      "type": "tool-call-count",
      "config": {}
    },
    {
      "type": "token-usage",
      "config": { "track": "total" }
    }
  ]
}
```

**Result:**
- Run passes if: LLM judge passes AND latency < 3s AND response contains booking ref
- Metrics tracked: `{ "tool-call-count": 2, "token-usage": 856 }`

## Key Decisions

### 1. Built-in vs Custom

**Built-in evaluators** (ship with core):
- Assertions: `llm-judge`, `latency-budget`, `regex`, `json-schema`, `token-budget`
- Metrics: `tool-call-count`, `response-length`, `token-usage`

**Custom evaluators** (future): Plugin system (separate proposal)

### 2. Backwards Compatibility

Existing scenarios with `successCriteria`/`failureCriteria` continue to work:
- Implicitly converted to `{ type: "llm-judge", config: { successCriteria, failureCriteria } }`
- No migration required
- `evaluators` array takes precedence if both exist

### 3. When Evaluators Run

- **After each connector invocation** (per turn)
- All evaluators run in parallel
- Results aggregated: all assertions must pass

### 4. Assertions vs Metrics

**Why the distinction?**

Without it, you'd need to configure every metric as "this doesn't fail":
```json
// BAD: confusing
{ "type": "tool-call-count", "config": { "failIfGreaterThan": 999999 } }
```

With `kind`, it's explicit:
```json
// GOOD: clear intent
{ "type": "tool-call-count", "config": {} }  // metric, never fails
```

## Open Questions

1. **Evaluator composition?** e.g., "pass if (LLM-judge OR regex) AND latency-budget"
   - **Decision:** No. Keep it simple. All assertions must pass (AND logic only).

2. **Evaluator weights?** e.g., "LLM-judge is more important than regex"
   - **Decision:** No. All assertions are equal.

3. **Per-evaluator termination?** e.g., "exit early if latency fails, but continue if regex fails"
   - **Decision:** No. All evaluators run every turn. Termination is based on aggregated success/failure.

4. **Should metrics be able to become assertions?** e.g., "fail if tool-call-count > 5"
   - **Decision:** Yes, but as a separate evaluator. E.g., `tool-call-budget` (assertion) vs `tool-call-count` (metric).

5. **How do evaluators handle connector-specific data?**
   - **Problem:** Tool calls, token usage, etc. depend on what the connector returns. Not all connectors provide this data.
   - **Solution:** Evaluators gracefully degrade when data is unavailable.

## Connector-Specific Data

### The Problem

Different connectors return different shapes:

```typescript
// HTTP connector might return
{
  messages: [{ role: "assistant", content: "text" }],
  latencyMs: 1234
}

// LangGraph connector might return
{
  messages: [
    { role: "assistant", content: "text", tool_calls: [...] }
  ],
  latencyMs: 1234,
  tokenUsage: { input: 123, output: 456 }
}
```

Some evaluators need data that not all connectors provide:
- `tool-call-count` needs `tool_calls` in messages
- `token-usage` needs `tokenUsage` from the connector

### The Solution

**Standardized Connector Response Format:**

All connectors must normalize their responses into a standard shape:

```typescript
interface ConnectorResponse {
  messages: Message[];              // Required: array of messages returned
  latencyMs: number;                // Required: response time
  tokenUsage?: {                    // Optional: normalized token usage
    input: number;
    output: number;
    total: number;
  };
  metadata?: Record<string, unknown>;  // Optional: connector-specific extras
}

interface Message {
  role: string;
  content: string;
  tool_calls?: ToolCall[];          // Optional: normalized tool calls
}

interface ToolCall {
  id: string;
  type: string;                     // e.g., "function"
  function: {
    name: string;
    arguments: string;              // JSON string
  };
}
```

**Each connector normalizes its raw response:**

```typescript
// OpenAI connector - tool_calls already in OpenAI format
async invoke(request) {
  const rawResponse = await openai.chat.completions.create(...);
  return {
    messages: rawResponse.choices.map(c => ({
      role: c.message.role,
      content: c.message.content,
      tool_calls: c.message.tool_calls  // Already normalized
    })),
    latencyMs: ...,
    tokenUsage: rawResponse.usage ? {
      input: rawResponse.usage.prompt_tokens,
      output: rawResponse.usage.completion_tokens,
      total: rawResponse.usage.total_tokens
    } : undefined
  };
}

// Custom LangGraph connector - normalizes to OpenAI format
async invoke(request) {
  const rawResponse = await fetch(this.url, ...);
  return {
    messages: rawResponse.messages.map(m => ({
      role: m.role,
      content: m.content,
      tool_calls: m.actions?.map(a => ({  // Normalize custom format
        id: a.action_id,
        type: "function",
        function: {
          name: a.tool,
          arguments: JSON.stringify(a.params)
        }
      }))
    })),
    latencyMs: rawResponse.elapsed_ms,
    tokenUsage: rawResponse.tokens ? {
      input: rawResponse.tokens.prompt,
      output: rawResponse.tokens.completion,
      total: rawResponse.tokens.total
    } : undefined
  };
}
```

**Evaluators work with the normalized format:**

```typescript
// tool-call-count evaluator
async evaluate(ctx) {
  let count = 0;
  for (const msg of ctx.lastInvocation.messages) {
    if (msg.tool_calls) {  // All connectors use same structure
      count += msg.tool_calls.length;
    }
  }

  return {
    success: true,
    value: count,
    reason: count === 0
      ? "No tool calls (or connector doesn't support tool_calls)"
      : `${count} tool call(s) in this turn`
  };
}

// token-usage evaluator
async evaluate(ctx) {
  if (!ctx.lastInvocation.tokenUsage) {
    return {
      success: true,
      value: 0,
      reason: "No token usage data available (connector doesn't provide it)"
    };
  }

  return {
    success: true,
    value: ctx.lastInvocation.tokenUsage.total,
    reason: `Token usage: ${ctx.lastInvocation.tokenUsage.total} (${ctx.lastInvocation.tokenUsage.input} in / ${ctx.lastInvocation.tokenUsage.output} out)`
  };
}
```

**Key principles:**
- **Connectors normalize at the boundary** — Each connector type is responsible for converting its raw response into the standard `ConnectorResponse` format
- **OpenAI format as the standard** — We adopt OpenAI's message and tool_calls structure since it's widely used and well-documented
- **Metrics never fail** — If data is unavailable, return `value: 0` with an explanatory reason
- **Assertions fail explicitly** — If an assertion needs data that's unavailable, fail with a clear message (e.g., `token-budget` fails if connector doesn't provide token data)
- **Universal evaluators work everywhere** — `response-length`, `regex`, `json-schema`, `llm-judge` work with any connector
- **Connector-specific evaluators document requirements** — `tool-call-count`, `token-usage` note "Requires connector that provides X"

## UI Impact

### Scenario Form

- "Add Evaluator" dropdown, grouped by kind:
  - **Assertions** (can cause failure)
  - **Metrics** (tracked only)
- Each evaluator shows auto-generated form from JSON Schema config

### Run Detail Page

Two tables:

**Assertions:**
| Evaluator | Result | Reason |
|-----------|--------|--------|
| LLM Judge | ✅ Pass | Agent booked successfully |
| Latency Budget | ✅ Pass | 1,234ms / 3,000ms |

**Metrics:**
| Metric | Value | Reason |
|--------|-------|--------|
| Tool Call Count | 3 | 3 tool call(s) in this turn |
| Token Usage | 856 | Token usage (total): 856 |

## Next Steps

1. Agree on core principles (this doc)
2. Detailed design doc with implementation plan
3. Implement built-in evaluators
4. Separate proposal for custom evaluators (plugins)
