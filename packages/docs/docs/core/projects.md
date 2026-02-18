---
sidebar_position: 2
---

# Projects

A project in EvalStudio is defined by a directory containing an `evalstudio.config.json` file. One directory = one project. There is no separate project entity to create or manage -- the config file **is** the project.

## Project Structure

When you run `evalstudio init`, a project directory is created with this structure:

```
my-evals/
  evalstudio.config.json   # Project configuration (commit to git)
  data/                    # Entity data storage
    personas.json
    scenarios.json
    evals.json
    runs.json
    executions.json
    connectors.json
```

## Configuration File

The `evalstudio.config.json` file defines the project settings:

```json
{
  "name": "my-product-evals",
  "maxConcurrency": 5,
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

## Import

```typescript
import {
  getProjectConfig,
  updateProjectConfig,
  type ProjectConfig,
  type UpdateProjectConfigInput,
  type LLMProviderSettings,
  type ProjectLLMSettings,
} from "@evalstudio/core";
```

## Types

### ProjectConfig

```typescript
interface ProjectConfig {
  version: number;
  name: string;                          // Project name
  maxConcurrency?: number;               // Max concurrent run executions (default: 3)
  llmProvider?: LLMProviderSettings;     // LLM provider credentials
  llmSettings?: ProjectLLMSettings;      // Model selection per use-case
}
```

### LLMProviderSettings

The single LLM provider configuration, stored inline in the config file.

```typescript
interface LLMProviderSettings {
  provider: ProviderType;  // "openai" or "anthropic"
  apiKey: string;          // API key for the provider
}
```

### ProjectLLMSettings

Configure which models to use for different use-cases. The provider is shared — only the model varies.

```typescript
interface ProjectLLMSettings {
  /** Model for evaluation/judging conversations */
  evaluation?: {
    model?: string;  // Specific model (optional, uses provider default)
  };
  /** Model for persona response generation */
  persona?: {
    model?: string;  // Specific model (falls back to evaluation model if not set)
  };
}
```

### UpdateProjectConfigInput

```typescript
interface UpdateProjectConfigInput {
  name?: string;
  maxConcurrency?: number | null;                // null to clear (reverts to default: 3)
  llmProvider?: LLMProviderSettings | null;      // null to remove provider
  llmSettings?: ProjectLLMSettings | null;       // null to clear settings
}
```

## Functions

### getProjectConfig()

Reads the current project configuration from `evalstudio.config.json`.

```typescript
function getProjectConfig(): ProjectConfig;
```

```typescript
const config = getProjectConfig();
console.log(config.name);  // "my-product-evals"
console.log(config.llmProvider?.provider);  // "openai"
```

### updateProjectConfig()

Updates the project configuration in `evalstudio.config.json`.

```typescript
function updateProjectConfig(input: UpdateProjectConfigInput): ProjectConfig;
```

```typescript
const updated = updateProjectConfig({
  llmProvider: {
    provider: "openai",
    apiKey: "sk-your-api-key",
  },
  llmSettings: {
    evaluation: { model: "gpt-4o" },
  },
});
```

## Project Directory Resolution

EvalStudio resolves the project directory in this order:

1. `setProjectDir()` -- programmatic override (for tests or embedding)
2. `EVALSTUDIO_PROJECT_DIR` -- environment variable
3. **Local project** -- walks up from `cwd` looking for `evalstudio.config.json`

## Storage

All entity data (personas, scenarios, evals, runs, etc.) is stored as JSON files in the `data/` subdirectory of the project.
