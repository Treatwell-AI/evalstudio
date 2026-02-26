---
sidebar_position: 5
---

# Evals

Manage evals that define test configurations for scenarios. Evals can contain one or more scenarios, and specify the connector for evaluation. LLM providers for evaluation judging are configured at the project level. Personas are associated with scenarios, not with evals directly. When running an eval, runs are created for each scenario/persona combination.

## Import

```typescript
import {
  createProjectModules,
  createStorageProvider,
  resolveWorkspace,
  type Eval,
  type EvalWithRelations,
  type CreateEvalInput,
  type UpdateEvalInput,
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

### Eval

```typescript
interface Eval {
  id: string;                              // Unique identifier (UUID)
  name: string;                            // Display name for the eval
  scenarioIds: string[];                   // Associated scenario IDs (required - at least one)
  connectorId?: string;                    // Connector for running this eval
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

### CreateEvalInput

```typescript
interface CreateEvalInput {
  name: string;                            // Required: display name for the eval
  connectorId: string;                     // Required: connector for running this eval
  scenarioIds: string[];                   // Required: at least one scenario ID
}
```

### UpdateEvalInput

```typescript
interface UpdateEvalInput {
  name?: string;                           // Update display name
  scenarioIds?: string[];                  // Update scenario IDs (at least one required)
  connectorId?: string;                    // Update connector for this eval
}
```

## Methods

### modules.evals.create()

Creates a new eval.

```typescript
async function create(input: CreateEvalInput): Promise<Eval>;
```

**Throws**: Error if the connector doesn't exist, if any scenario doesn't exist, or if scenarioIds is empty.

Note: LLM provider for evaluation is configured at the project level via `evalstudio.config.json` `llmSettings`.

```typescript
// Create an eval with a single scenario
const evalItem = await modules.evals.create({
  name: "Booking Test",
  connectorId: "connector-uuid",           // Required: connector for the agent
  scenarioIds: ["scenario-uuid"],          // Required: at least one scenario
});

// Create an eval with multiple scenarios (test collection)
const multiScenarioEval = await modules.evals.create({
  name: "Full Agent Test Suite",
  connectorId: "connector-uuid",
  scenarioIds: ["scenario-1", "scenario-2", "scenario-3"],
});
```

### modules.evals.get()

Gets an eval by its ID.

```typescript
async function get(id: string): Promise<Eval | undefined>;
```

```typescript
const evalItem = await modules.evals.get("987fcdeb-51a2-3bc4-d567-890123456789");
```

### modules.evals.getByScenario()

Gets an eval by scenario.

```typescript
async function getByScenario(scenarioId: string): Promise<Eval | undefined>;
```

```typescript
const evalItem = await modules.evals.getByScenario("scenario-uuid");
```

### modules.evals.getWithRelations()

Gets an eval by ID with scenario details included.

```typescript
async function getWithRelations(id: string): Promise<EvalWithRelations | undefined>;
```

```typescript
const evalItem = await modules.evals.getWithRelations("987fcdeb-51a2-3bc4-d567-890123456789");
// evalItem.scenarios[0].name -> "Booking Cancellation"
// evalItem.scenarios.length -> number of scenarios in the eval
```

### modules.evals.list()

Lists all evals in the project.

```typescript
async function list(): Promise<Eval[]>;
```

```typescript
const allEvals = await modules.evals.list();
```

### modules.evals.update()

Updates an existing eval.

```typescript
async function update(id: string, input: UpdateEvalInput): Promise<Eval | undefined>;
```

**Throws**: Error if any scenario doesn't exist, or if scenarioIds is empty.

```typescript
// Update to a single scenario
const updated = await modules.evals.update(evalItem.id, {
  scenarioIds: ["new-scenario-uuid"],
});

// Update to multiple scenarios
const multiUpdated = await modules.evals.update(evalItem.id, {
  scenarioIds: ["scenario-1", "scenario-2"],
});
```

### modules.evals.delete()

Deletes an eval by its ID.

```typescript
async function delete(id: string): Promise<boolean>;
```

Returns `true` if the eval was deleted, `false` if not found.

```typescript
const deleted = await modules.evals.delete(evalItem.id);
```

## Scenarios and Run Creation

Evals can contain multiple scenarios, allowing you to create comprehensive test collections. When running an eval:

1. The system iterates through each scenario in `scenarioIds`
2. For each scenario, it uses the personas associated with that scenario
3. A run is created for each scenario/persona combination

For example, if an eval has 2 scenarios, and each scenario has 3 personas, running the eval creates 6 runs (2 x 3).

Personas are associated with scenarios, not with evals directly. This allows different scenarios to test different persona types.

## Storage

Evals are stored in `data/evals.json` within the project directory.
