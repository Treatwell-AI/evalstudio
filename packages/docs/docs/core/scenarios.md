---
sidebar_position: 4
---

# Scenarios

Manage scenarios to define test context for conversations. Scenarios belong to a project and contain instructions that provide all the context needed for the LLM to simulate the conversation. Scenarios can also include initial messages to seed conversations, allowing you to test from a specific point in a conversation.

## Import

```typescript
import {
  createScenario,
  getScenario,
  getScenarioByName,
  listScenarios,
  updateScenario,
  deleteScenario,
  deleteScenariosByProject,
  type Scenario,
  type CreateScenarioInput,
  type UpdateScenarioInput,
  type Message,
} from "@evalstudio/core";
```

## Types

### Scenario

```typescript
interface Scenario {
  id: string;            // Unique identifier (UUID)
  projectId: string;     // Parent project ID
  name: string;          // Scenario name (unique within project)
  instructions?: string; // Instructions providing all context for the scenario
  messages?: Message[];  // Initial messages to seed the conversation
  maxMessages?: number;  // Maximum conversation turns before stopping
  successCriteria?: string;  // Natural language success criteria
  failureCriteria?: string;  // Natural language failure criteria
  failureCriteriaMode?: FailureCriteriaMode; // "on_max_messages" (default) or "every_turn"
  personaIds?: string[]; // IDs of associated personas
  createdAt: string;     // ISO 8601 timestamp
  updatedAt: string;     // ISO 8601 timestamp
}

type FailureCriteriaMode = "every_turn" | "on_max_messages";
```

### Message

```typescript
interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}
```

### CreateScenarioInput

```typescript
interface CreateScenarioInput {
  projectId: string;
  name: string;
  instructions?: string;
  messages?: Message[];
  maxMessages?: number;
  successCriteria?: string;
  failureCriteria?: string;
  failureCriteriaMode?: FailureCriteriaMode;
  personaIds?: string[];
}
```

### UpdateScenarioInput

```typescript
interface UpdateScenarioInput {
  name?: string;
  instructions?: string;
  messages?: Message[];
  maxMessages?: number;
  successCriteria?: string;
  failureCriteria?: string;
  failureCriteriaMode?: FailureCriteriaMode;
  personaIds?: string[];
}
```

## Functions

### createScenario()

Creates a new scenario within a project.

```typescript
function createScenario(input: CreateScenarioInput): Scenario;
```

**Throws**: Error if the project doesn't exist or if a scenario with the same name already exists in the project.

```typescript
// Simple scenario with just instructions
const scenario = createScenario({
  projectId: "123e4567-e89b-12d3-a456-426614174000",
  name: "booking-cancellation",
  instructions: "Customer wants to cancel a haircut appointment for tomorrow. They have a scheduling conflict. Booking was made 3 days ago with 24h cancellation policy.",
});

// Scenario with initial messages to continue from a specific point
const midConversationScenario = createScenario({
  projectId: "123e4567-e89b-12d3-a456-426614174000",
  name: "cancellation-mid-flow",
  instructions: "Continue the cancellation flow. Customer should receive refund confirmation.",
  messages: [
    { role: "user", content: "Hi, I need to cancel my appointment" },
    { role: "assistant", content: "I'd be happy to help you cancel. Can you provide your booking reference?" },
    { role: "user", content: "It's ABC123" },
  ],
});
```

### getScenario()

Gets a scenario by its ID.

```typescript
function getScenario(id: string): Scenario | undefined;
```

```typescript
const scenario = getScenario("987fcdeb-51a2-3bc4-d567-890123456789");
```

### getScenarioByName()

Gets a scenario by its name within a specific project.

```typescript
function getScenarioByName(projectId: string, name: string): Scenario | undefined;
```

```typescript
const scenario = getScenarioByName(
  "123e4567-e89b-12d3-a456-426614174000",
  "booking-cancellation"
);
```

### listScenarios()

Lists scenarios, optionally filtered by project.

```typescript
function listScenarios(projectId?: string): Scenario[];
```

```typescript
// List all scenarios
const allScenarios = listScenarios();

// List scenarios for a specific project
const projectScenarios = listScenarios("123e4567-e89b-12d3-a456-426614174000");
```

### updateScenario()

Updates an existing scenario.

```typescript
function updateScenario(id: string, input: UpdateScenarioInput): Scenario | undefined;
```

**Throws**: Error if updating to a name that already exists in the project.

```typescript
const updated = updateScenario(scenario.id, {
  instructions: "Customer wants to cancel appointment. VIP customer with flexible policy.",
});
```

### deleteScenario()

Deletes a scenario by its ID.

```typescript
function deleteScenario(id: string): boolean;
```

Returns `true` if the scenario was deleted, `false` if not found.

```typescript
const deleted = deleteScenario(scenario.id);
```

### deleteScenariosByProject()

Deletes all scenarios belonging to a project.

```typescript
function deleteScenariosByProject(projectId: string): number;
```

Returns the number of scenarios deleted.

```typescript
const count = deleteScenariosByProject("123e4567-e89b-12d3-a456-426614174000");
console.log(`Deleted ${count} scenarios`);
```

## Storage

Scenarios are stored in `~/.evalstudio/scenarios.json`.
