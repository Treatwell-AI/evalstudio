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

## Import

```typescript
import {
  getProjectConfig,
  updateProjectConfig,
  type ProjectConfig,
  type UpdateProjectConfigInput,
  type LLMSettings,
  type LLMModelSettings,
} from "@evalstudio/core";
```

## Types

### ProjectConfig

```typescript
interface ProjectConfig {
  version: number;
  name: string;                   // Project name
  maxConcurrency?: number;        // Max concurrent run executions (default: 3)
  llmSettings?: LLMSettings;     // LLM provider, credentials, and model selection
}
```

### LLMSettings

Unified LLM configuration: provider credentials and model selection in a single object.

```typescript
interface LLMSettings {
  provider: ProviderType;          // "openai" or "anthropic"
  apiKey: string;                  // API key for the provider
  models?: LLMModelSettings;      // Model selection per use-case
}
```

### LLMModelSettings

Configure which models to use for different use-cases. The provider is shared — only the model varies.

```typescript
interface LLMModelSettings {
  /** Model for evaluation/judging conversations (optional, uses provider default) */
  evaluation?: string;
  /** Model for persona response generation (optional, falls back to evaluation model) */
  persona?: string;
}
```

### UpdateProjectConfigInput

```typescript
interface UpdateProjectConfigInput {
  name?: string;
  maxConcurrency?: number | null;        // null to clear (reverts to default: 3)
  llmSettings?: LLMSettings | null;      // null to remove LLM configuration
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
console.log(config.llmSettings?.provider);  // "openai"
```

### updateProjectConfig()

Updates the project configuration in `evalstudio.config.json`.

```typescript
function updateProjectConfig(input: UpdateProjectConfigInput): ProjectConfig;
```

```typescript
const updated = updateProjectConfig({
  llmSettings: {
    provider: "openai",
    apiKey: "sk-your-api-key",
    models: {
      evaluation: "gpt-4o",
    },
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
