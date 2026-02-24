# Spec: Standardized Connector Contract

## Problem

Connectors return different data structures, making it impossible to build evaluators that depend on structured data:

- ❌ **No token usage normalization**: Different field names across providers
- ❌ **Tool calls not standardized**: Different formats or missing entirely
- ❌ **Metadata scattered**: Some data in results, some in messages, some lost
- ❌ **Evaluators can't depend on data**: Can't build `token-budget` or `tool-call-count` evaluators

This blocks the flexible evaluators proposal (see [flexible-evaluators-simple.md](./flexible-evaluators-simple.md)).

## Proposal

Define a **strict contract** that all connectors must implement. Connectors normalize their raw responses at the boundary.

### Core Type: ConnectorInvokeResult

```typescript
export interface ConnectorInvokeResult {
  success: boolean;
  latencyMs: number;
  messages?: Message[];
  rawResponse?: string;
  error?: string;

  // NEW: Normalized metadata
  tokensUsage?: TokensUsage;
  threadId?: string;
}
```

**What's new:**

- `tokensUsage` - Normalized tokens usage from the connector
- `threadId` - Thread/conversation ID for stateful connectors

### Usage Type

```typescript
export interface TokensUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}
```

**Simple and universal:**

- `input_tokens` - Input/prompt tokens
- `output_tokens` - Output/completion tokens
- `total_tokens` - Total tokens (input + output)

**Why these field names?**

- Matches LangGraph and Anthropic exactly
- Close to OpenAI (just different from `prompt_tokens`/`completion_tokens`)
- Consistent underscore naming across all fields

### Provider Field Mapping

| Provider         | Input Field       | Output Field          | Total Field     |
| ---------------- | ----------------- | --------------------- | --------------- |
| **Our Standard** | `input_tokens`    | `output_tokens`       | `total_tokens`  |
| OpenAI           | `prompt_tokens`   | `completion_tokens`   | `total_tokens`  |
| LangGraph        | `input_tokens`    | `output_tokens`       | `total_tokens`  |
| Anthropic        | `input_tokens`    | `output_tokens`       | (sum)           |

**Normalization:**
- LangGraph: Direct passthrough (already uses our format)
- Anthropic: Direct passthrough for input/output, calculate total
- OpenAI: Map `prompt_tokens` → `input_tokens`, `completion_tokens` → `output_tokens`

## Message Format (OpenAI Standard)

We use OpenAI's message format for `tool_calls` since it's the industry standard:

```typescript
export interface Message {
  role: "user" | "assistant" | "system" | "tool";
  content: string | ContentBlock[] | null;

  // Tool calling (OpenAI format)
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;

  // Optional
  id?: string;

  // Debug/passthrough metadata from external systems (not consumed by application)
  metadata?: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string; // JSON string, NOT parsed object
  };
}
```

**Key points:**

- `arguments` is a **JSON string** (per OpenAI spec)
- `content` can be `null` when `tool_calls` present
- `content` can also be an array of `ContentBlock[]` for multi-part messages
- All connectors normalize tool calls to this exact format
- `metadata` is a catch-all field for provider-specific data (e.g., `additional_kwargs`, `response_metadata` from LangGraph/LangChain)

## Run Storage

```typescript
export interface Run {
  id: string;
  evalId?: string;
  personaId?: string;
  scenarioId: string;
  connectorId?: string;
  executionId?: number;
  status: RunStatus;
  startedAt?: string;
  completedAt?: string;

  // Flattened metadata fields (at top-level for consistency)
  latencyMs?: number;
  tokensUsage?: TokensUsage;
  threadId?: string;

  messages: Message[];
  output?: Record<string, unknown>;
  result?: RunResult;
  error?: string;
  createdAt: string;
  updatedAt: string;
}
```

**Design Decision: Flat Structure**

We chose to flatten metadata fields (`latencyMs`, `tokensUsage`, `threadId`) to the top level of `Run` instead of nesting them in a `metadata` object because:

1. **Consistency** - Keeps temporal fields at the same level (`startedAt`, `completedAt`, `latencyMs`)
2. **Type Safety** - No index signature, makes the structure strict and predictable
3. **Simplicity** - Clearer access patterns (`run.latencyMs` vs `run.metadata?.latencyMs`)

**Migration from existing code:**

- Old: `metadata: { tokenUsage: { input, output } }`
- New: `tokensUsage: { input_tokens, output_tokens, total_tokens }` (top-level field)
- Old: `metadata: { latencyMs }`
- New: `latencyMs` (top-level field)

## Next Steps

In the next sections, we'll cover:

1. **Connector Strategy Interface** - How connectors implement normalization
2. **Implementation Examples** - LangGraph, OpenAI, HTTP connectors
3. **Updated Modules** - Changes to connector.ts and run-processor.ts
4. **Migration Path** - Step-by-step implementation plan

---

**Ready to continue?** Let me know and I'll add the next section.
