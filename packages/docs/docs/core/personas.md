---
sidebar_position: 3
---

# Personas

Manage personas to simulate different user interactions during testing. Personas belong to a project and define a description and system prompt for test scenarios.

## Import

```typescript
import {
  createPersona,
  getPersona,
  getPersonaByName,
  listPersonas,
  updatePersona,
  deletePersona,
  deletePersonasByProject,
  type Persona,
  type CreatePersonaInput,
  type UpdatePersonaInput,
} from "@evalstudio/core";
```

## Types

### Persona

```typescript
interface Persona {
  id: string;            // Unique identifier (UUID)
  projectId: string;     // Parent project ID
  name: string;          // Persona name (unique within project)
  description?: string;  // Short description of the persona
  systemPrompt?: string; // Full description / system prompt for this persona
  createdAt: string;     // ISO 8601 timestamp
  updatedAt: string;     // ISO 8601 timestamp
}
```

### CreatePersonaInput

```typescript
interface CreatePersonaInput {
  projectId: string;
  name: string;
  description?: string;
  systemPrompt?: string;
}
```

### UpdatePersonaInput

```typescript
interface UpdatePersonaInput {
  name?: string;
  description?: string;
  systemPrompt?: string;
}
```

## Functions

### createPersona()

Creates a new persona within a project.

```typescript
function createPersona(input: CreatePersonaInput): Persona;
```

**Throws**: Error if the project doesn't exist or if a persona with the same name already exists in the project.

```typescript
const persona = createPersona({
  projectId: "123e4567-e89b-12d3-a456-426614174000",
  name: "impatient-user",
  description: "A user who wants quick answers",
  systemPrompt: "You are an impatient user who values brevity and expects quick, concise responses.",
});
```

### getPersona()

Gets a persona by its ID.

```typescript
function getPersona(id: string): Persona | undefined;
```

```typescript
const persona = getPersona("987fcdeb-51a2-3bc4-d567-890123456789");
```

### getPersonaByName()

Gets a persona by its name within a specific project.

```typescript
function getPersonaByName(projectId: string, name: string): Persona | undefined;
```

```typescript
const persona = getPersonaByName(
  "123e4567-e89b-12d3-a456-426614174000",
  "impatient-user"
);
```

### listPersonas()

Lists personas, optionally filtered by project.

```typescript
function listPersonas(projectId?: string): Persona[];
```

```typescript
// List all personas
const allPersonas = listPersonas();

// List personas for a specific project
const projectPersonas = listPersonas("123e4567-e89b-12d3-a456-426614174000");
```

### updatePersona()

Updates an existing persona.

```typescript
function updatePersona(id: string, input: UpdatePersonaInput): Persona | undefined;
```

**Throws**: Error if updating to a name that already exists in the project.

```typescript
const updated = updatePersona(persona.id, {
  systemPrompt: "You are a technical user who expects detailed, accurate responses.",
});
```

### deletePersona()

Deletes a persona by its ID.

```typescript
function deletePersona(id: string): boolean;
```

Returns `true` if the persona was deleted, `false` if not found.

```typescript
const deleted = deletePersona(persona.id);
```

### deletePersonasByProject()

Deletes all personas belonging to a project.

```typescript
function deletePersonasByProject(projectId: string): number;
```

Returns the number of personas deleted.

```typescript
const count = deletePersonasByProject("123e4567-e89b-12d3-a456-426614174000");
console.log(`Deleted ${count} personas`);
```

## Storage

Personas are stored in `~/.evalstudio/personas.json`.
