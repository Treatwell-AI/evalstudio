---
sidebar_position: 6
---

# LLM Providers

The LLM provider configuration defines the credentials used for evaluation judging and persona generation. The provider is stored inline in `evalstudio.config.json` — there is no separate entity or storage file.

## Import

```typescript
import {
  getLLMProviderFromConfig,
  getDefaultModels,
  fetchProviderModels,
  type LLMProvider,
  type LLMProviderSettings,
  type ProviderType,
  type LLMProviderConfig,
} from "@evalstudio/core";
```

## Types

### ProviderType

```typescript
type ProviderType = "openai" | "anthropic";
```

### LLMProviderSettings

Stored in `evalstudio.config.json` under the `llmProvider` key.

```typescript
interface LLMProviderSettings {
  provider: ProviderType;  // Provider type (openai or anthropic)
  apiKey: string;          // API key for the provider
}
```

### LLMProvider

Runtime representation used internally by the evaluator and persona generator.

```typescript
interface LLMProvider {
  provider: ProviderType;
  apiKey: string;
  config?: LLMProviderConfig;
}
```

### LLMProviderConfig

```typescript
interface LLMProviderConfig {
  [key: string]: unknown;
}
```

## Functions

### getLLMProviderFromConfig()

Reads the LLM provider from the project config and returns an `LLMProvider` object.

```typescript
function getLLMProviderFromConfig(): LLMProvider;
```

**Throws**: Error if no LLM provider is configured in `evalstudio.config.json`.

```typescript
const provider = getLLMProviderFromConfig();
console.log(provider.provider);  // "openai"
```

### getDefaultModels()

Returns the list of default/fallback models for each provider type.

```typescript
function getDefaultModels(): { openai: string[]; anthropic: string[] };
```

```typescript
const models = getDefaultModels();
console.log(models.openai);     // ["gpt-4.1", "gpt-4o", ...]
console.log(models.anthropic);  // ["claude-opus-4-5-20251101", ...]
```

### fetchProviderModels()

Fetches available models dynamically from the provider's API. For OpenAI providers, this queries the `/v1/models` endpoint and filters for chat-capable models. For Anthropic, returns the default model list (no public models endpoint available).

```typescript
async function fetchProviderModels(providerType: ProviderType, apiKey: string): Promise<string[]>;
```

**Throws**: Error if the API request fails.

```typescript
const models = await fetchProviderModels("openai", "sk-your-api-key");
console.log(models);  // ["gpt-4.1", "gpt-4.1-mini", "gpt-4o", "gpt-4o-mini", ...]
```

## Configuration

The LLM provider is configured in `evalstudio.config.json`:

```json
{
  "name": "my-project",
  "llmProvider": {
    "provider": "openai",
    "apiKey": "sk-your-api-key"
  },
  "llmSettings": {
    "evaluation": { "model": "gpt-4o" },
    "persona": { "model": "gpt-4o-mini" }
  }
}
```

See [Projects](./projects.md) for the full config reference.
