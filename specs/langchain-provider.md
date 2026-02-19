# LangChain LLM Provider

**Status:** Proposal
**Date:** 2026-02-19

---

## Problem

EvalStudio's LLM client (`llm-client.ts`) uses raw `fetch()` calls to OpenAI and Anthropic APIs. This was a deliberate choice — it keeps `@evalstudio/core` at zero production dependencies and is perfectly adequate for direct API calls.

But some teams need more:

- **Observability**: LangSmith / Langfuse tracing of every evaluation and persona generation call, with spans, token counts, and latency breakdowns — without manual instrumentation
- **More providers**: Azure OpenAI, Google Vertex AI, AWS Bedrock, Cohere, Mistral, local models via Ollama — LangChain supports 50+ providers through a single interface
- **Built-in resilience**: Retries, exponential backoff, fallback chains, rate limit handling — all configured declaratively
- **Streaming**: Token-by-token streaming for long evaluations (future use)

The current `llm-client.ts` would need to grow provider-specific code for each of these. LangChain already solves them.

---

## Proposal

Add `@evalstudio/langchain` as an optional package — same pattern as `@evalstudio/postgres`. When installed, it replaces the built-in `fetch()`-based LLM client with LangChain's model abstraction. When not installed, nothing changes.

---

## User Profiles

Same split as the storage backends:

- **Local / quick usage**: `npx @evalstudio/cli init && npx @evalstudio/cli serve` — built-in fetch client, zero setup, zero deps
- **Team / production**: a `package.json` with `@evalstudio/cli` + `@evalstudio/langchain` — LangChain-powered LLM calls, observability, more providers

```json
{
  "dependencies": {
    "@evalstudio/cli": "^1.0.0",
    "@evalstudio/langchain": "^1.0.0"
  }
}
```

---

## Architecture

### LLMClientProvider abstraction

Core introduces an `LLMClientProvider` interface — the seam between business logic (evaluator, persona generator) and the LLM transport layer.

```typescript
// packages/core/src/llm-client-provider.ts

interface LLMClientProvider {
  chatCompletion(
    provider: LLMProvider,
    messages: ChatCompletionMessage[],
    options?: ChatCompletionOptions,
  ): Promise<ChatCompletionResult>;
}
```

This is intentionally minimal — one method, same signature as today's `chatCompletion()` function. The existing function becomes the default implementation.

### Built-in provider (no change for current users)

```typescript
// packages/core/src/llm-client.ts (existing, unchanged)

function createFetchLLMClient(): LLMClientProvider {
  return {
    chatCompletion: fetchChatCompletion, // renamed from chatCompletion
  };
}
```

The existing `chatCompletion` function is the implementation. The only change is wrapping it in the interface.

### LangChain provider

```typescript
// packages/langchain/src/index.ts

import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import type { LLMClientProvider } from "@evalstudio/core";

function createLangChainLLMClient(options?: LangChainOptions): LLMClientProvider {
  return {
    async chatCompletion(provider, messages, options) {
      const model = createModel(provider, options);
      const result = await model.invoke(toLangChainMessages(messages));
      return { content: extractContent(result) };
    },
  };
}
```

### Wiring: dynamic import

Same pattern as postgres — core dynamically imports `@evalstudio/langchain` when configured:

```typescript
// packages/core/src/llm-client-factory.ts

async function createLLMClient(config: WorkspaceConfig): Promise<LLMClientProvider> {
  if (config.llmClient?.type === "langchain") {
    let mod;
    try {
      mod = await import("@evalstudio/langchain");
    } catch {
      throw new Error(
        "LangChain LLM client requires the @evalstudio/langchain package.\n" +
        "Install it with: npm install @evalstudio/langchain"
      );
    }
    return mod.createLangChainLLMClient(config.llmClient.options);
  }

  return createFetchLLMClient();
}
```

---

## Configuration

### evalstudio.config.json

Add a top-level `llmClient` field (separate from `llmSettings` which configures _which_ provider/key/model to use — `llmClient` configures _how_ to call it):

```json
{
  "version": 3,
  "name": "My Workspace",
  "llmClient": {
    "type": "langchain"
  },
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

When `llmClient` is omitted or `llmClient.type` is `"fetch"`, behavior is identical to today.

### Config types

```typescript
type LLMClientType = "fetch" | "langchain";

interface FetchLLMClientConfig {
  type: "fetch";
}

interface LangChainLLMClientConfig {
  type: "langchain";
  options?: LangChainOptions;
}

type LLMClientConfig = FetchLLMClientConfig | LangChainLLMClientConfig;

interface LangChainOptions {
  /** LangSmith callbacks — auto-detected from LANGCHAIN_* env vars if not set */
  callbacks?: boolean;
  /** Custom base URL for compatible APIs (e.g., Azure, local models) */
  baseUrl?: string;
}
```

### Environment variable auto-detection

LangChain natively reads `LANGCHAIN_TRACING_V2`, `LANGCHAIN_API_KEY`, `LANGCHAIN_PROJECT` for LangSmith, and `LANGFUSE_*` vars for Langfuse via community integrations. No explicit config needed — just set the env vars and install the package.

---

## New Package: `@evalstudio/langchain`

### Package structure

```
packages/langchain/
  package.json
  src/
    index.ts                  # Public API: createLangChainLLMClient()
    langchain-client.ts       # LLMClientProvider implementation
    messages.ts               # Message format conversion (EvalStudio ↔ LangChain)
    models.ts                 # Model factory (provider type → ChatModel instance)
```

### Dependencies

```json
{
  "name": "@evalstudio/langchain",
  "dependencies": {
    "@langchain/core": "^0.3.0",
    "@langchain/openai": "^0.4.0",
    "@langchain/anthropic": "^0.3.0",
    "@evalstudio/core": "workspace:*"
  },
  "peerDependencies": {
    "@langchain/google-vertexai": ">=0.1.0",
    "@langchain/community": ">=0.3.0"
  },
  "peerDependenciesMeta": {
    "@langchain/google-vertexai": { "optional": true },
    "@langchain/community": { "optional": true }
  }
}
```

OpenAI and Anthropic are direct dependencies (matching EvalStudio's built-in providers). Other providers are optional peers — install only what you use.

### Public API

```typescript
// packages/langchain/src/index.ts

import type { LLMClientProvider } from "@evalstudio/core";

export function createLangChainLLMClient(options?: LangChainOptions): LLMClientProvider;
```

### Model factory

```typescript
// packages/langchain/src/models.ts

import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import type { LLMProvider, ChatCompletionOptions } from "@evalstudio/core";

function createModel(provider: LLMProvider, options?: ChatCompletionOptions) {
  const model = options?.model ?? getDefaultModelForProvider(provider.provider);
  const temperature = options?.temperature;

  switch (provider.provider) {
    case "openai":
      return new ChatOpenAI({ openAIApiKey: provider.apiKey, modelName: model, temperature });
    case "anthropic":
      return new ChatAnthropic({ anthropicApiKey: provider.apiKey, modelName: model, temperature });
    default:
      throw new Error(`Unsupported provider: ${provider.provider}`);
  }
}
```

### Message conversion

```typescript
// packages/langchain/src/messages.ts

import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import type { ChatCompletionMessage } from "@evalstudio/core";

function toLangChainMessages(messages: ChatCompletionMessage[]) {
  return messages.map((m) => {
    switch (m.role) {
      case "system": return new SystemMessage(m.content);
      case "user": return new HumanMessage(m.content);
      case "assistant": return new AIMessage(m.content);
    }
  });
}

function extractContent(result: AIMessage): string {
  return typeof result.content === "string"
    ? result.content
    : result.content.map((c) => c.text).join("");
}
```

---

## What This Enables

### Additional providers (no core changes)

With LangChain, `llmSettings.provider` can be extended to support more providers. The `@evalstudio/langchain` package handles the mapping:

```json
{
  "llmSettings": {
    "provider": "azure-openai",
    "apiKey": "${AZURE_OPENAI_API_KEY}",
    "config": {
      "azureOpenAIApiDeploymentName": "my-gpt4",
      "azureOpenAIApiInstanceName": "my-instance",
      "azureOpenAIApiVersion": "2024-02-15-preview"
    }
  },
  "llmClient": {
    "type": "langchain"
  }
}
```

The `ProviderType` union in core expands from `"openai" | "anthropic"` to include additional types when LangChain is active. The langchain package's model factory maps them to the right `@langchain/*` classes.

### Observability (zero config)

```bash
# Just set env vars — LangChain auto-detects
export LANGCHAIN_TRACING_V2=true
export LANGCHAIN_API_KEY=ls_...
export LANGCHAIN_PROJECT=evalstudio

evalstudio serve
```

Every `chatCompletion` call (evaluation + persona generation) gets traced in LangSmith with full message history, token counts, and latency.

### Resilience

```typescript
// Future: configurable retry/fallback in langchain options
{
  "llmClient": {
    "type": "langchain",
    "options": {
      "maxRetries": 3,
      "fallbackModel": "gpt-4o-mini"
    }
  }
}
```

---

## Core Changes

### New files

| File | Purpose |
|---|---|
| `llm-client-provider.ts` | `LLMClientProvider` interface |
| `llm-client-factory.ts` | `createLLMClient()` with dynamic import |

### Modified files

| File | Change |
|---|---|
| `llm-client.ts` | Wrap existing `chatCompletion` in `createFetchLLMClient()` factory. Export both the function (backwards compat) and the factory. |
| `evaluator.ts` | Accept `LLMClientProvider` instead of calling `chatCompletion` directly |
| `persona-generator.ts` | Accept `LLMClientProvider` instead of calling `chatCompletion` directly |
| `run-processor.ts` | Create `LLMClientProvider` once, pass to evaluator + persona generator |
| `project.ts` | Add `llmClient?: LLMClientConfig` to `WorkspaceConfig` |
| `index.ts` | Export `LLMClientProvider`, `createLLMClient`, `createFetchLLMClient` |

### What doesn't change

- `llmSettings` config (provider, apiKey, models) — unchanged
- `LLMProvider` type — unchanged
- Entity modules, storage, connectors — unaffected
- Web UI — unaffected (doesn't call LLM directly)

---

## Injection Pattern

The evaluator and persona generator currently import and call `chatCompletion` directly:

```typescript
// Before
import { chatCompletion } from "./llm-client.js";

async function evaluateCriteria(input: EvaluateCriteriaInput) {
  const result = await chatCompletion(input.llmProvider, messages, { model });
  // ...
}
```

After the refactor, they receive the client via their input:

```typescript
// After
async function evaluateCriteria(input: EvaluateCriteriaInput & { llmClient: LLMClientProvider }) {
  const result = await input.llmClient.chatCompletion(input.llmProvider, messages, { model });
  // ...
}
```

The `RunProcessor` creates the client once and threads it through:

```typescript
// run-processor.ts
const llmClient = await createLLMClient(workspaceConfig);

// Pass to evaluator
await evaluateCriteria({ ...input, llmClient });

// Pass to persona generator
await generatePersonaMessage({ ...input, llmClient });
```

---

## Observability

The built-in fetch client has no observability support — calls are opaque. With `@evalstudio/langchain`, LangSmith tracing works out of the box: set `LANGCHAIN_TRACING_V2=true` + `LANGCHAIN_API_KEY` env vars and LangChain traces all calls automatically. Every evaluation and persona generation call gets full spans with message history, token counts, and latency.

---

## Implementation Phases

### Phase 1 — LLMClientProvider abstraction

Pure refactor of core. No new package, no config changes. Built-in fetch client works identically.

- `LLMClientProvider` interface
- `createFetchLLMClient()` wraps existing `chatCompletion`
- `evaluator.ts` and `persona-generator.ts` accept injected client
- `run-processor.ts` creates and threads the client

### Phase 2 — `@evalstudio/langchain` package

New package implementing `LLMClientProvider` via LangChain. Wires into core via dynamic import.

- `@evalstudio/langchain` package with OpenAI + Anthropic support
- `llmClient` config field in `evalstudio.config.json`
- `llm-client-factory.ts` in core with dynamic `import("@evalstudio/langchain")`
- Message format conversion
- Observability via LangChain callbacks (auto-detected from env vars)

### Phase 3 — Additional providers

Expand provider support beyond OpenAI and Anthropic.

- Provider type registry (extensible `ProviderType`)
- Azure OpenAI, Google Vertex AI, Bedrock support in `@evalstudio/langchain`
- UI updates for additional provider configuration

---

## Scope

### Out of scope

- Streaming support (future — would require `LLMClientProvider` interface change)
- Custom LangChain chains or agents (this package wraps simple chat completion only)
- LangGraph integration for evaluation (separate concern from connector-level LangGraph support)
- Langfuse integration (requires explicit CallbackHandler wiring — can be added later)
- Migration tooling (no data to migrate — just install the package and update config)
