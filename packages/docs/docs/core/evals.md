---
sidebar_position: 5
---

# Evals

Manage evals that define test configurations for scenarios. Evals can contain one or more scenarios, and specify the connector for evaluation. LLM providers for evaluation judging are configured at the project level. Personas are associated with scenarios, not with evals directly. When running an eval, runs are created for each scenario/persona combination.

## Import

```typescript
import {
  createEval,
  getEval,
  getEvalByScenario,
  getEvalWithRelations,
  listEvals,
  updateEval,
  deleteEval,
  type Eval,
  type EvalWithRelations,
  type CreateEvalInput,
  type UpdateEvalInput,
  type Message,
} from "@evalstudio/core";
```

## Types

### Eval

```typescript
interface Eval {
  id: string;                              // Unique identifier (UUID)
  name: string;                            // Display name for the eval
  input: Message[];                        // Initial input messages (seed conversation)
  scenarioIds: string[];                   // Associated scenario IDs (required - at least one)
  connectorId: string;                     // Connector for running this eval (required)
  createdAt: string;                       // ISO 8601 timestamp
  updatedAt: string;                       // ISO 8601 timestamp
}
```

Note: LLM provider for evaluation is configured at the project level via `evalstudio.config.json` `llmSettings`.

### EvalWithRelations

```typescript
interface ScenarioSummary {
  id: string;
  name: string;
  instructions?: string;
  messages?: Message[];
  maxMessages?: number;
  successCriteria?: string;
  failureCriteria?: string;
  failureCriteriaMode?: FailureCriteriaMode;
}

interface EvalWithRelations extends Eval {
  scenarios: ScenarioSummary[];            // Array of scenario details
  connector?: {
    id: string;
    name: string;
    type: string;
    baseUrl: string;
  };
}
```

### Message

```typescript
interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}
```

### CreateEvalInput

```typescript
interface CreateEvalInput {
  name: string;                            // Required: display name for the eval
  connectorId: string;                     // Required: connector for running this eval
  scenarioIds: string[];                   // Required: at least one scenario ID
  input?: Message[];                       // Default: []
}
```

### UpdateEvalInput

```typescript
interface UpdateEvalInput {
  name?: string;                           // Update display name
  input?: Message[];                       // Update input messages
  scenarioIds?: string[];                  // Update scenario IDs (at least one required)
  connectorId?: string;                    // Update connector for this eval
}
```

## Functions

### createEval()

Creates a new eval.

```typescript
function createEval(input: CreateEvalInput): Eval;
```

**Throws**: Error if the connector doesn't exist, if any scenario doesn't exist, or if scenarioIds is empty.

Note: LLM provider for evaluation is configured at the project level via `evalstudio.config.json` `llmSettings`.

```typescript
// Create an eval with a single scenario
const evalItem = createEval({
  name: "Booking Test",
  connectorId: "connector-uuid",           // Required: connector for the agent
  scenarioIds: ["scenario-uuid"],          // Required: at least one scenario
});

// Create an eval with multiple scenarios (test collection)
const multiScenarioEval = createEval({
  name: "Full Agent Test Suite",
  connectorId: "connector-uuid",
  scenarioIds: ["scenario-1", "scenario-2", "scenario-3"], // Multiple scenarios
});

// Create an eval with seed messages
const seededEval = createEval({
  name: "Seeded Conversation Test",
  connectorId: "connector-uuid",
  scenarioIds: ["scenario-uuid"],
  input: [
    { role: "user", content: "I need to cancel my booking" },
    { role: "assistant", content: "I can help with that. Can you provide your booking ID?" },
  ],
});
```

### getEval()

Gets an eval by its ID.

```typescript
function getEval(id: string): Eval | undefined;
```

```typescript
const evalItem = getEval("987fcdeb-51a2-3bc4-d567-890123456789");
```

### getEvalByScenario()

Gets an eval by scenario.

```typescript
function getEvalByScenario(scenarioId: string): Eval | undefined;
```

```typescript
const evalItem = getEvalByScenario("scenario-uuid");
```

### getEvalWithRelations()

Gets an eval by ID with scenario details included.

```typescript
function getEvalWithRelations(id: string): EvalWithRelations | undefined;
```

```typescript
const evalItem = getEvalWithRelations("987fcdeb-51a2-3bc4-d567-890123456789");
// evalItem.scenarios[0].name -> "Booking Cancellation"
// evalItem.scenarios.length -> number of scenarios in the eval
```

### listEvals()

Lists all evals in the project.

```typescript
function listEvals(): Eval[];
```

```typescript
const allEvals = listEvals();
```

### updateEval()

Updates an existing eval.

```typescript
function updateEval(id: string, input: UpdateEvalInput): Eval | undefined;
```

**Throws**: Error if any scenario doesn't exist, or if scenarioIds is empty.

```typescript
// Update to a single scenario
const updated = updateEval(evalItem.id, {
  scenarioIds: ["new-scenario-uuid"],
});

// Update to multiple scenarios
const multiUpdated = updateEval(evalItem.id, {
  scenarioIds: ["scenario-1", "scenario-2"],
});
```

### deleteEval()

Deletes an eval by its ID.

```typescript
function deleteEval(id: string): boolean;
```

Returns `true` if the eval was deleted, `false` if not found.

```typescript
const deleted = deleteEval(evalItem.id);
```

## Scenarios and Run Creation

Evals can contain multiple scenarios, allowing you to create comprehensive test collections. When running an eval:

1. The system iterates through each scenario in `scenarioIds`
2. For each scenario, it uses the personas associated with that scenario
3. A run is created for each scenario/persona combination

For example, if an eval has 2 scenarios, and each scenario has 3 personas, running the eval creates 6 runs (2 × 3).

Personas are associated with scenarios, not with evals directly. This allows different scenarios to test different persona types.

## Storage

Evals are stored in `data/evals.json` within the project directory.
