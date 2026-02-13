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
    llm-providers.json
```

## Configuration File

The `evalstudio.config.json` file defines the project settings:

```json
{
  "name": "my-product-evals",
  "llmSettings": {
    "evaluation": {
      "providerId": "provider-uuid",
      "model": "gpt-4o"
    },
    "persona": {
      "providerId": "provider-uuid",
      "model": "gpt-4o-mini"
    }
  }
}
```

## Import

```typescript
import {
  getProject,
  updateProject,
  type Project,
  type UpdateProjectInput,
} from "@evalstudio/core";
```

## Types

### Project

```typescript
interface Project {
  name: string;                      // Project name
  llmSettings?: ProjectLLMSettings;  // LLM configuration
}
```

### ProjectLLMSettings

Configure which LLM providers and models to use for different use-cases within the project.

```typescript
interface ProjectLLMSettings {
  /** LLM settings for evaluation/judging conversations */
  evaluation?: {
    providerId: string;  // LLM provider ID
    model?: string;      // Specific model (optional, uses provider default)
  };
  /** LLM settings for persona response generation */
  persona?: {
    providerId: string;  // LLM provider ID (falls back to evaluation if not set)
    model?: string;      // Specific model (optional)
  };
}
```

### UpdateProjectInput

```typescript
interface UpdateProjectInput {
  name?: string;
  llmSettings?: ProjectLLMSettings | null;  // null to clear settings
}
```

## Functions

### getProject()

Reads the current project configuration from `evalstudio.config.json`.

```typescript
function getProject(): Project;
```

```typescript
const project = getProject();
console.log(project.name);  // "my-product-evals"
```

### updateProject()

Updates the project configuration in `evalstudio.config.json`.

```typescript
function updateProject(input: UpdateProjectInput): Project;
```

```typescript
const updated = updateProject({
  llmSettings: {
    evaluation: {
      providerId: "provider-uuid",
      model: "gpt-4o",
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
