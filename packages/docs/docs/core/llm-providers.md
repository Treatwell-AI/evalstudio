---
sidebar_position: 6
---

# LLM Providers

The LLM provider configuration defines the credentials used for evaluation judging and persona generation. The provider is stored inline in `evalstudio.config.json` under the `llmSettings` key — there is no separate entity or storage file.

## Import

```typescript
import {
  getLLMProviderFromConfig,
  getDefaultModels,
  type LLMProvider,
  type LLMSettings,
  type LLMModelSettings,
  type ModelGroup,
  type ProviderType,
} from "@evalstudio/core";
```

## Types

### ProviderType

```typescript
type ProviderType = "openai" | "anthropic";
```

### LLMSettings

Unified LLM configuration stored in `evalstudio.config.json`.

```typescript
interface LLMSettings {
  provider: ProviderType;          // Provider type (openai or anthropic)
  apiKey: string;                  // API key for the provider
  models?: LLMModelSettings;      // Model selection per use-case
}
```

### LLMModelSettings

```typescript
interface LLMModelSettings {
  evaluation?: string;  // Model for evaluation/judging (optional, uses provider default)
  persona?: string;     // Model for persona generation (optional, falls back to evaluation)
}
```

### ModelGroup

Models are organized into groups (e.g., Standard, Premium) per provider.

```typescript
interface ModelGroup {
  label: string;     // Group name (e.g., "Standard", "Premium")
  models: string[];  // Model IDs in this group
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

Returns grouped model lists for each provider type, organized by tier (Standard, Premium).

```typescript
function getDefaultModels(): Record<ProviderType, ModelGroup[]>;
```

```typescript
const models = getDefaultModels();

// Each provider returns an array of ModelGroup
for (const group of models.openai) {
  console.log(group.label);   // "Standard" or "Premium"
  console.log(group.models);  // ["gpt-4o", "gpt-4o-mini", ...]
}
```

## Configuration

The LLM provider is configured in `evalstudio.config.json`:

```json
{
  "name": "my-project",
  "llmSettings": {
    "provider": "openai",
    "apiKey": "sk-your-api-key",
    "models": {
      "evaluation": "gpt-4o",
      "persona": "gpt-4o-mini"
    }
  }
}
```

See [Projects](./projects.md) for the full config reference.
