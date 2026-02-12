---
sidebar_position: 6
---

# LLM Providers

Manage LLM provider configurations for persona simulation and evaluation. LLM providers belong to a project and define the provider credentials used during eval execution.

## Import

```typescript
import {
  createLLMProvider,
  getLLMProvider,
  getLLMProviderByName,
  listLLMProviders,
  updateLLMProvider,
  deleteLLMProvider,
  deleteLLMProvidersByProject,
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
  projectId: string;       // Parent project ID
  name: string;            // Provider name (unique within project)
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
  projectId: string;
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

Creates a new LLM provider within a project.

```typescript
function createLLMProvider(input: CreateLLMProviderInput): LLMProvider;
```

**Throws**: Error if the project doesn't exist or if an LLM provider with the same name already exists in the project.

```typescript
const provider = createLLMProvider({
  projectId: "123e4567-e89b-12d3-a456-426614174000",
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

Gets an LLM provider by its name within a specific project.

```typescript
function getLLMProviderByName(projectId: string, name: string): LLMProvider | undefined;
```

```typescript
const provider = getLLMProviderByName(
  "123e4567-e89b-12d3-a456-426614174000",
  "Production OpenAI"
);
```

### listLLMProviders()

Lists LLM providers, optionally filtered by project.

```typescript
function listLLMProviders(projectId?: string): LLMProvider[];
```

```typescript
// List all providers
const allProviders = listLLMProviders();

// List providers for a specific project
const projectProviders = listLLMProviders("123e4567-e89b-12d3-a456-426614174000");
```

### updateLLMProvider()

Updates an existing LLM provider.

```typescript
function updateLLMProvider(id: string, input: UpdateLLMProviderInput): LLMProvider | undefined;
```

**Throws**: Error if updating to a name that already exists in the project.

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

### deleteLLMProvidersByProject()

Deletes all LLM providers belonging to a project.

```typescript
function deleteLLMProvidersByProject(projectId: string): number;
```

Returns the number of providers deleted.

```typescript
const count = deleteLLMProvidersByProject("123e4567-e89b-12d3-a456-426614174000");
console.log(`Deleted ${count} providers`);
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

LLM providers are stored in `~/.evalstudio/llm-providers.json`.
