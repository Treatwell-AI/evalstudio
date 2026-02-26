---
sidebar_position: 4
---

# Scenarios

Manage scenarios to define test context for conversations. Scenarios contain instructions that provide all the context needed for the LLM to simulate the conversation. Scenarios can also include initial messages to seed conversations, allowing you to test from a specific point in a conversation.

## Import

```typescript
import {
  createProjectModules,
  createStorageProvider,
  resolveWorkspace,
  type Scenario,
  type CreateScenarioInput,
  type UpdateScenarioInput,
  type FailureCriteriaMode,
  type ScenarioEvaluator,
  type Message,
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

### Scenario

```typescript
interface Scenario {
  id: string;            // Unique identifier (UUID)
  name: string;          // Scenario name (unique)
  instructions?: string; // Instructions providing all context for the scenario
  messages?: Message[];  // Initial messages to seed the conversation
  maxMessages?: number;  // Maximum conversation turns before stopping
  successCriteria?: string;  // Natural language success criteria
  failureCriteria?: string;  // Natural language failure criteria
  failureCriteriaMode?: FailureCriteriaMode; // "on_max_messages" (default) or "every_turn"
  evaluators?: ScenarioEvaluator[]; // Custom evaluators (assertions and/or metrics)
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
  name: string;
  instructions?: string;
  messages?: Message[];
  maxMessages?: number;
  successCriteria?: string;
  failureCriteria?: string;
  failureCriteriaMode?: FailureCriteriaMode;
  evaluators?: ScenarioEvaluator[];
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
  evaluators?: ScenarioEvaluator[];
  personaIds?: string[];
}
```

## Methods

### modules.scenarios.create()

Creates a new scenario.

```typescript
async function create(input: CreateScenarioInput): Promise<Scenario>;
```

**Throws**: Error if a scenario with the same name already exists.

```typescript
// Simple scenario with just instructions
const scenario = await modules.scenarios.create({
  name: "booking-cancellation",
  instructions: "Customer wants to cancel a haircut appointment for tomorrow. They have a scheduling conflict. Booking was made 3 days ago with 24h cancellation policy.",
});

// Scenario with initial messages to continue from a specific point
const midConversationScenario = await modules.scenarios.create({
  name: "cancellation-mid-flow",
  instructions: "Continue the cancellation flow. Customer should receive refund confirmation.",
  messages: [
    { role: "user", content: "Hi, I need to cancel my appointment" },
    { role: "assistant", content: "I'd be happy to help you cancel. Can you provide your booking reference?" },
    { role: "user", content: "It's ABC123" },
  ],
});
```

### modules.scenarios.get()

Gets a scenario by its ID.

```typescript
async function get(id: string): Promise<Scenario | undefined>;
```

```typescript
const scenario = await modules.scenarios.get("987fcdeb-51a2-3bc4-d567-890123456789");
```

### modules.scenarios.getByName()

Gets a scenario by its name.

```typescript
async function getByName(name: string): Promise<Scenario | undefined>;
```

```typescript
const scenario = await modules.scenarios.getByName("booking-cancellation");
```

### modules.scenarios.list()

Lists all scenarios in the project.

```typescript
async function list(): Promise<Scenario[]>;
```

```typescript
const allScenarios = await modules.scenarios.list();
```

### modules.scenarios.update()

Updates an existing scenario.

```typescript
async function update(id: string, input: UpdateScenarioInput): Promise<Scenario | undefined>;
```

**Throws**: Error if updating to a name that already exists.

```typescript
const updated = await modules.scenarios.update(scenario.id, {
  instructions: "Customer wants to cancel appointment. VIP customer with flexible policy.",
});
```

### modules.scenarios.delete()

Deletes a scenario by its ID.

```typescript
async function delete(id: string): Promise<boolean>;
```

Returns `true` if the scenario was deleted, `false` if not found.

```typescript
const deleted = await modules.scenarios.delete(scenario.id);
```

## Storage

Scenarios are stored in `data/scenarios.json` within the project directory.
