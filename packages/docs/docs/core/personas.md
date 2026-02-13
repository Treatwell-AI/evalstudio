---
sidebar_position: 3
---

# Personas

Manage personas to simulate different user interactions during testing. Personas define a description and system prompt for test scenarios.

## Import

```typescript
import {
  createPersona,
  getPersona,
  getPersonaByName,
  listPersonas,
  updatePersona,
  deletePersona,
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
  name: string;          // Persona name (unique)
  description?: string;  // Short description of the persona
  systemPrompt?: string; // Full description / system prompt for this persona
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

Creates a new persona.

```typescript
function createPersona(input: CreatePersonaInput): Persona;
```

**Throws**: Error if a persona with the same name already exists.

```typescript
const persona = createPersona({
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

Gets a persona by its name.

```typescript
function getPersonaByName(name: string): Persona | undefined;
```

```typescript
const persona = getPersonaByName("impatient-user");
```

### listPersonas()

Lists all personas in the project.

```typescript
function listPersonas(): Persona[];
```

```typescript
const allPersonas = listPersonas();
```

### updatePersona()

Updates an existing persona.

```typescript
function updatePersona(id: string, input: UpdatePersonaInput): Persona | undefined;
```

**Throws**: Error if updating to a name that already exists.

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

## Storage

Personas are stored in `data/personas.json` within the project directory.
