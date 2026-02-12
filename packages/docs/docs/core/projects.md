---
sidebar_position: 2
---

# Projects

Manage projects to organize different evaluation contexts (e.g., different products or teams).

## Import

```typescript
import {
  createProject,
  getProject,
  getProjectByName,
  listProjects,
  updateProject,
  deleteProject,
  type Project,
  type CreateProjectInput,
  type UpdateProjectInput,
} from "@evalstudio/core";
```

## Types

### Project

```typescript
interface Project {
  id: string;                        // Unique identifier (UUID)
  name: string;                      // Project name (unique)
  description?: string;              // Optional description
  llmSettings?: ProjectLLMSettings;  // LLM configuration for the project
  createdAt: string;                 // ISO 8601 timestamp
  updatedAt: string;                 // ISO 8601 timestamp
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

### CreateProjectInput

```typescript
interface CreateProjectInput {
  name: string;
  description?: string;
  llmSettings?: ProjectLLMSettings;
}
```

### UpdateProjectInput

```typescript
interface UpdateProjectInput {
  name?: string;
  description?: string;
  llmSettings?: ProjectLLMSettings | null;  // null to clear settings
}
```

## Functions

### createProject()

Creates a new project.

```typescript
function createProject(input: CreateProjectInput): Project;
```

**Throws**: Error if a project with the same name already exists.

```typescript
const project = createProject({
  name: "my-product",
  description: "Evaluations for my product",
});
```

### getProject()

Gets a project by its ID.

```typescript
function getProject(id: string): Project | undefined;
```

```typescript
const project = getProject("123e4567-e89b-12d3-a456-426614174000");
```

### getProjectByName()

Gets a project by its name.

```typescript
function getProjectByName(name: string): Project | undefined;
```

```typescript
const project = getProjectByName("my-product");
```

### listProjects()

Lists all projects.

```typescript
function listProjects(): Project[];
```

```typescript
const projects = listProjects();
projects.forEach((p) => console.log(p.name));
```

### updateProject()

Updates an existing project.

```typescript
function updateProject(id: string, input: UpdateProjectInput): Project | undefined;
```

**Throws**: Error if updating to a name that already exists.

```typescript
const updated = updateProject(project.id, {
  description: "Updated description",
});
```

### deleteProject()

Deletes a project by its ID.

```typescript
function deleteProject(id: string): boolean;
```

Returns `true` if the project was deleted, `false` if not found.

```typescript
const deleted = deleteProject(project.id);
```

## Storage

Projects are stored in `~/.evalstudio/projects.json`.
