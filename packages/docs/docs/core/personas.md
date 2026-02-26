---
sidebar_position: 3
---

# Personas

Manage personas to simulate different user interactions during testing. Personas define a description and system prompt for test scenarios.

## Import

```typescript
import {
  createProjectModules,
  createStorageProvider,
  resolveWorkspace,
  type Persona,
  type CreatePersonaInput,
  type UpdatePersonaInput,
} from "@evalstudio/core";
```

## Setup

All entity operations are accessed through project modules:

```typescript
const workspaceDir = resolveWorkspace();
const storage = await createStorageProvider(workspaceDir);
const modules = createProjectModules(storage, projectId);
```

## Types

### Persona

```typescript
interface Persona {
  id: string;            // Unique identifier (UUID)
  name: string;          // Persona name (unique)
  description?: string;  // Short description of the persona
  systemPrompt?: string; // Full description / system prompt for this persona
  imageUrl?: string;     // Image ID referencing a stored image
  headers?: Record<string, string>; // HTTP headers merged with connector headers
  createdAt: string;     // ISO 8601 timestamp
  updatedAt: string;     // ISO 8601 timestamp
}
```

### CreatePersonaInput

```typescript
interface CreatePersonaInput {
  name: string;
  description?: string;
  systemPrompt?: string;
  headers?: Record<string, string>;
}
```

### UpdatePersonaInput

```typescript
interface UpdatePersonaInput {
  name?: string;
  description?: string;
  systemPrompt?: string;
  imageUrl?: string;
  headers?: Record<string, string>;
}
```

## Methods

### modules.personas.create()

Creates a new persona.

```typescript
async function create(input: CreatePersonaInput): Promise<Persona>;
```

**Throws**: Error if a persona with the same name already exists.

```typescript
const persona = await modules.personas.create({
  name: "impatient-user",
  description: "A user who wants quick answers",
  systemPrompt: "You are an impatient user who values brevity and expects quick, concise responses.",
  headers: {
    "X-User-Language": "en",
    "X-User-Tier": "premium",
  },
});
```

### modules.personas.get()

Gets a persona by its ID.

```typescript
async function get(id: string): Promise<Persona | undefined>;
```

```typescript
const persona = await modules.personas.get("987fcdeb-51a2-3bc4-d567-890123456789");
```

### modules.personas.getByName()

Gets a persona by its name.

```typescript
async function getByName(name: string): Promise<Persona | undefined>;
```

```typescript
const persona = await modules.personas.getByName("impatient-user");
```

### modules.personas.list()

Lists all personas in the project.

```typescript
async function list(): Promise<Persona[]>;
```

```typescript
const allPersonas = await modules.personas.list();
```

### modules.personas.update()

Updates an existing persona.

```typescript
async function update(id: string, input: UpdatePersonaInput): Promise<Persona | undefined>;
```

**Throws**: Error if updating to a name that already exists.

```typescript
const updated = await modules.personas.update(persona.id, {
  systemPrompt: "You are a technical user who expects detailed, accurate responses.",
});
```

### modules.personas.delete()

Deletes a persona by its ID.

```typescript
async function delete(id: string): Promise<boolean>;
```

Returns `true` if the persona was deleted, `false` if not found.

```typescript
const deleted = await modules.personas.delete(persona.id);
```

## Storage

Personas are stored in `data/personas.json` within the project directory.
