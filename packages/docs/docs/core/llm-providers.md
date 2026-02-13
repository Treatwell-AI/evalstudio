---
sidebar_position: 6
---

# LLM Providers

Manage LLM provider configurations for persona simulation and evaluation. LLM providers define the provider credentials used during eval execution.

## Import

```typescript
import {
  createLLMProvider,
  getLLMProvider,
  getLLMProviderByName,
  listLLMProviders,
  updateLLMProvider,
  deleteLLMProvider,
  getDefaultModels,
  fetchProviderModels,
  type LLMProvider,
  type CreateLLMProviderInput,
  type UpdateLLMProviderInput,
  type ProviderType,
  type LLMProviderConfig,
} from "@evalstudio/core";
```

## Types

### ProviderType

```typescript
type ProviderType = "openai" | "anthropic";
```

### LLMProviderConfig

```typescript
interface LLMProviderConfig {
  [key: string]: unknown;
}
```

### LLMProvider

```typescript
interface LLMProvider {
  id: string;              // Unique identifier (UUID)
  name: string;            // Provider name (unique)
  provider: ProviderType;  // Provider type (openai or anthropic)
  apiKey: string;          // API key for the provider
  config?: LLMProviderConfig; // Optional configuration
  createdAt: string;       // ISO 8601 timestamp
  updatedAt: string;       // ISO 8601 timestamp
}
```

### CreateLLMProviderInput

```typescript
interface CreateLLMProviderInput {
  name: string;
  provider: ProviderType;
  apiKey: string;
  config?: LLMProviderConfig;
}
```

### UpdateLLMProviderInput

```typescript
interface UpdateLLMProviderInput {
  name?: string;
  provider?: ProviderType;
  apiKey?: string;
  config?: LLMProviderConfig;
}
```

## Functions

### createLLMProvider()

Creates a new LLM provider.

```typescript
function createLLMProvider(input: CreateLLMProviderInput): LLMProvider;
```

**Throws**: Error if an LLM provider with the same name already exists.

```typescript
const provider = createLLMProvider({
  name: "Production OpenAI",
  provider: "openai",
  apiKey: "sk-your-api-key",
});
```

### getLLMProvider()

Gets an LLM provider by its ID.

```typescript
function getLLMProvider(id: string): LLMProvider | undefined;
```

```typescript
const provider = getLLMProvider("987fcdeb-51a2-3bc4-d567-890123456789");
```

### getLLMProviderByName()

Gets an LLM provider by its name.

```typescript
function getLLMProviderByName(name: string): LLMProvider | undefined;
```

```typescript
const provider = getLLMProviderByName("Production OpenAI");
```

### listLLMProviders()

Lists all LLM providers in the project.

```typescript
function listLLMProviders(): LLMProvider[];
```

```typescript
const allProviders = listLLMProviders();
```

### updateLLMProvider()

Updates an existing LLM provider.

```typescript
function updateLLMProvider(id: string, input: UpdateLLMProviderInput): LLMProvider | undefined;
```

**Throws**: Error if updating to a name that already exists.

```typescript
const updated = updateLLMProvider(provider.id, {
  name: "Updated Provider Name",
});
```

### deleteLLMProvider()

Deletes an LLM provider by its ID.

```typescript
function deleteLLMProvider(id: string): boolean;
```

Returns `true` if the provider was deleted, `false` if not found.

```typescript
const deleted = deleteLLMProvider(provider.id);
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
async function fetchProviderModels(providerId: string): Promise<string[]>;
```

**Throws**: Error if the provider doesn't exist or if the API request fails.

```typescript
// Fetch models for an OpenAI provider
const models = await fetchProviderModels("987fcdeb-51a2-3bc4-d567-890123456789");
console.log(models);  // ["gpt-4.1", "gpt-4.1-mini", "gpt-4o", "gpt-4o-mini", ...]
```

## Storage

LLM providers are stored in `data/llm-providers.json` within the project directory.
