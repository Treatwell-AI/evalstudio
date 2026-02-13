---
sidebar_position: 6
---

# Runs

Manage evaluation runs that track the execution of evals with specific runtime configurations. Runs capture the conversation history, results, and metadata for each eval execution.

## Import

```typescript
import {
  createRun,
  createRuns,
  createPlaygroundRun,
  getRun,
  listRuns,
  listRunsByEval,
  updateRun,
  deleteRun,
  deleteRunsByEval,
  RunProcessor,
  evaluateCriteria,
  generatePersonaMessage,
  type Run,
  type RunStatus,
  type RunResult,
  type RunMetadata,
  type CreateRunInput,
  type CreatePlaygroundRunInput,
  type UpdateRunInput,
  type ListRunsOptions,
  type RunProcessorOptions,
  type CriteriaEvaluationResult,
  type GeneratePersonaMessageResult,
} from "@evalstudio/core";
```

## Types

### Run

```typescript
interface Run {
  id: string;                    // Unique identifier (UUID)
  evalId?: string;               // Parent eval ID (optional for playground runs)
  personaId?: string;            // Persona ID used for this run
  scenarioId: string;            // Scenario ID used for this run
  connectorId?: string;          // Connector ID (for playground runs without eval)
  executionId?: number;          // Auto-generated ID grouping runs in the same batch
  status: RunStatus;             // Run status
  startedAt?: string;            // ISO timestamp when run started
  completedAt?: string;          // ISO timestamp when run completed
  messages: Message[];           // Conversation history (includes system prompt)
  output?: Record<string, unknown>; // Structured output (for structured mode)
  result?: RunResult;            // Evaluation result
  error?: string;                // Error message if failed
  metadata?: RunMetadata;        // Additional run metadata
  threadId?: string;             // Thread ID for LangGraph (regenerated on retry)
  createdAt: string;             // ISO 8601 timestamp
  updatedAt: string;             // ISO 8601 timestamp
}
```

Note: For eval-based runs, the connector is configured at the Eval level. For playground runs (without an eval), `connectorId` is stored directly on the run. LLM provider for evaluation is always configured at the project level via `evalstudio.config.json` `llmSettings`. The `personaId` and `scenarioId` are always stored directly on the run at creation time.

The `messages` array includes all messages stored during execution:
- System prompt (generated from persona/scenario)
- Seed messages from scenario
- Input messages from eval configuration
- Response messages from the agent

### RunStatus

```typescript
type RunStatus = "queued" | "pending" | "running" | "completed" | "error";
```

- `queued` - Run created and waiting to be executed
- `pending` - Run is being prepared for execution
- `running` - Run is currently executing
- `completed` - Run finished (check `result.success` for pass/fail). Evaluation failures use this status with `result.success: false`
- `error` - Run encountered a system error (check error field). Only runs with this status can be retried

### RunResult

```typescript
interface RunResult {
  success: boolean;    // Whether the eval passed
  score?: number;      // Optional score (0-1)
  reason?: string;     // Explanation of result
}
```

### RunMetadata

```typescript
interface RunMetadata {
  latencyMs?: number;             // Total execution time
  tokenUsage?: {
    input: number;
    output: number;
  };
  [key: string]: unknown;         // Additional metadata
}
```

### CreateRunInput

```typescript
interface CreateRunInput {
  evalId: string;                // Required: eval to run
}
```

Runs use the connector and LLM provider configured on the parent Eval. When runs are created, they are automatically assigned an `executionId` that groups all runs created in the same batch. This ID is auto-incremented.

### CreatePlaygroundRunInput

```typescript
interface CreatePlaygroundRunInput {
  scenarioId: string;            // Required: scenario to run
  connectorId: string;           // Required: connector for invoking the agent
  personaId?: string;            // Optional: persona to simulate
}
```

Used for creating runs directly from scenarios without requiring an eval. The connector is specified directly since there's no parent eval to inherit from. LLM provider for evaluation is resolved from the project's `evalstudio.config.json` `llmSettings`.

### UpdateRunInput

```typescript
interface UpdateRunInput {
  status?: RunStatus;
  startedAt?: string;
  completedAt?: string;
  messages?: Message[];
  output?: Record<string, unknown>;
  result?: RunResult;
  error?: string;
  metadata?: RunMetadata;
}
```

### ListRunsOptions

```typescript
interface ListRunsOptions {
  evalId?: string;       // Filter by eval ID
  status?: RunStatus;    // Filter by status
  limit?: number;        // Maximum number of runs to return
}
```

### RunProcessorOptions

```typescript
interface RunProcessorOptions {
  pollIntervalMs?: number;   // Polling interval in milliseconds (default: 5000)
  maxConcurrent?: number;    // Max concurrent runs (falls back to project config, then 3)
  onStatusChange?: (runId: string, status: RunStatus, run: Run) => void;
  onRunStart?: (run: Run) => void;
  onRunComplete?: (run: Run, result: ConnectorInvokeResult) => void;
  onRunError?: (run: Run, error: Error) => void;
}
```

## Functions

### createRuns()

Creates one or more runs for an eval. If the eval's scenario has multiple personas associated with it (`personaIds`), one run is created for each persona.

```typescript
function createRuns(input: CreateRunInput): Run[];
```

**Throws**: Error if the eval, scenario, or any persona doesn't exist.

```typescript
const runs = createRuns({
  evalId: "eval-uuid",
});
// If scenario has 3 personas, returns 3 runs
// Each run has personaId and scenarioId stored directly
// All runs share the same executionId (auto-assigned)
// runs[0].status === "queued"
```

### createRun()

Creates a single run for an eval. This is a convenience wrapper around `createRuns()` that returns only the first run.

```typescript
function createRun(input: CreateRunInput): Run;
```

**Throws**: Error if the eval doesn't exist.

```typescript
const run = createRun({
  evalId: "eval-uuid",
});
// run.status === "queued"
// run.personaId and run.scenarioId are stored directly
// run.executionId is auto-assigned
```

### createPlaygroundRun()

Creates a run directly from a scenario without requiring an eval. Useful for testing scenarios in a playground environment before setting up formal evaluations.

```typescript
function createPlaygroundRun(input: CreatePlaygroundRunInput): Run;
```

**Throws**: Error if the scenario, connector, or persona doesn't exist.

```typescript
const run = createPlaygroundRun({
  scenarioId: "scenario-uuid",
  connectorId: "connector-uuid",
  personaId: "persona-uuid",        // Optional
});
// run.status === "queued"
// run.evalId is undefined
// run.connectorId is stored directly
```

The run is processed by `RunProcessor` like any other run. The processor checks for `connectorId` on the run itself when `evalId` is not present. LLM provider for evaluation is resolved from the project's `evalstudio.config.json` `llmSettings`.

### getRun()

Gets a run by its ID.

```typescript
function getRun(id: string): Run | undefined;
```

```typescript
const run = getRun("run-uuid");
```

### listRuns()

Lists runs with flexible filtering options.

```typescript
function listRuns(options?: ListRunsOptions): Run[];
```

```typescript
// List all runs
const allRuns = listRuns();

// Filter by status
const queuedRuns = listRuns({ status: "queued", limit: 10 });

// Filter by eval
const evalRuns = listRuns({ evalId: "eval-uuid", status: "completed" });
```

When using the options-based API, results are sorted by `createdAt` (oldest first), making it suitable for queue processing.

### listRunsByEval()

Lists runs for a specific eval, sorted by creation date (newest first).

```typescript
function listRunsByEval(evalId: string): Run[];
```

```typescript
const evalRuns = listRunsByEval("eval-uuid");
// Returns runs sorted by createdAt descending
```

### updateRun()

Updates an existing run.

```typescript
function updateRun(id: string, input: UpdateRunInput): Run | undefined;
```

```typescript
// Start a run
updateRun(run.id, {
  status: "running",
  startedAt: new Date().toISOString(),
});

// Complete a run with success
updateRun(run.id, {
  status: "completed",
  completedAt: new Date().toISOString(),
  messages: [
    { role: "user", content: "Hello" },
    { role: "assistant", content: "Hi there!" },
  ],
  result: {
    success: true,
    score: 0.95,
    reason: "Agent responded appropriately",
  },
  metadata: {
    latencyMs: 1500,
    tokenUsage: { input: 50, output: 30 },
  },
});

// Mark a run as error (system failure - retryable)
updateRun(run.id, {
  status: "error",
  completedAt: new Date().toISOString(),
  error: "Connection timeout",
});
```

### deleteRun()

Deletes a run by its ID.

```typescript
function deleteRun(id: string): boolean;
```

Returns `true` if the run was deleted, `false` if not found.

```typescript
const deleted = deleteRun(run.id);
```

### deleteRunsByEval()

Deletes all runs belonging to an eval.

```typescript
function deleteRunsByEval(evalId: string): number;
```

Returns the number of runs deleted.

```typescript
const count = deleteRunsByEval("eval-uuid");
console.log(`Deleted ${count} runs`);
```

## Cascade Deletion

When an eval is deleted, all associated runs are automatically deleted via `deleteRunsByEval()`.

## RunProcessor

The `RunProcessor` class provides background execution of queued evaluation runs. It polls for runs with status "queued" and executes them via the configured connector.

### Creating a Processor

```typescript
const processor = new RunProcessor({
  pollIntervalMs: 5000,    // Poll every 5 seconds (default)
  maxConcurrent: 3,        // Process up to 3 runs concurrently (default)
  onStatusChange: (runId, status, run) => {
    console.log(`Run ${runId} is now ${status}`);
  },
  onRunStart: (run) => {
    console.log(`Started processing run ${run.id}`);
  },
  onRunComplete: (run, result) => {
    console.log(`Run ${run.id} completed:`, result.message?.content);
  },
  onRunError: (run, error) => {
    console.error(`Run ${run.id} failed:`, error.message);
  },
});
```

### Starting and Stopping

```typescript
// Start the processor (begins polling for queued runs)
processor.start();

// Check if running
console.log(processor.isRunning()); // true

// Get active run count
console.log(processor.getActiveRunCount()); // 0-maxConcurrent

// Graceful shutdown (waits for active runs to complete)
await processor.stop();
```

### One-Shot Processing

For CLI tools or testing, you can process queued runs without starting the polling loop:

```typescript
const processor = new RunProcessor();

// Process one batch of queued runs and wait for completion
const started = await processor.processOnce();
console.log(`Started ${started} runs`);
```

### Crash Recovery

When `start()` is called, the processor automatically resets any runs stuck in "running" status back to "queued". This handles recovery from crashes or unexpected shutdowns.

### Usage with CLI and API

The same `RunProcessor` can be used from both CLI and API contexts:

```typescript
// CLI usage
const processor = new RunProcessor({
  onStatusChange: (runId, status) => {
    process.stdout.write(`\r${runId}: ${status}`);
  },
});
processor.start();

// API usage (e.g., in Express/Fastify)
const processor = new RunProcessor({
  onStatusChange: (runId, status, run) => {
    websocket.broadcast({ type: 'run_status', runId, status, run });
  },
});
processor.start();
```

### Atomic Claiming

The processor uses atomic status transitions to prevent duplicate processing across multiple processor instances. When a run is claimed:

1. The run's status is checked to be "queued"
2. Status is atomically updated to "running"
3. If another processor claimed it first, the claim fails and the run is skipped

### Evaluation Loop

When an eval has an LLM provider configured, the RunProcessor uses a multi-turn evaluation loop:

1. **Send message to agent** - The user message (from scenario seed or generated) is sent to the connector
2. **Evaluate response** - The agent's response is evaluated against the scenario's `successCriteria` and `failureCriteria` using an LLM judge
3. **Check termination conditions**:
   - If `successCriteria` is met → Run completes as **passed**
   - If `failureCriteria` is met and `failureCriteriaMode` is `"every_turn"` → Run completes as **failed**
   - If `maxMessages` limit is reached → Run completes (pass/fail based on final evaluation)
   - Otherwise → Continue to step 4
4. **Generate next user message** - An LLM generates a contextual user message, optionally impersonating the configured persona
5. **Loop** - Return to step 1

**Failure Criteria Modes**: The `failureCriteriaMode` field on the scenario controls when failure criteria stops the loop:
- `"on_max_messages"` (default): Failure criteria is only checked when `maxMessages` is reached without success. This allows the agent to recover from mistakes during the conversation.
- `"every_turn"`: Failure criteria is checked at every turn, just like success criteria. The loop stops immediately when failure is detected.

If no LLM provider is configured, the processor falls back to single-turn execution (one request/response cycle).

## Evaluation Functions

### evaluateCriteria()

Evaluates a conversation against success and failure criteria using an LLM judge.

```typescript
interface EvaluateCriteriaInput {
  messages: Message[];
  successCriteria?: string;
  failureCriteria?: string;
  llmProviderId: string;
  model?: string;
}

interface CriteriaEvaluationResult {
  successMet: boolean;
  failureMet: boolean;
  confidence: number;  // 0-1 score
  reasoning: string;
  rawResponse?: string;
}

function evaluateCriteria(input: EvaluateCriteriaInput): Promise<CriteriaEvaluationResult>;
```

```typescript
const result = await evaluateCriteria({
  messages: conversationHistory,
  successCriteria: "User successfully booked an appointment",
  failureCriteria: "Agent refused to help or provided incorrect information",
  llmProviderId: "provider-uuid",
});

console.log(result.successMet);   // true/false
console.log(result.failureMet);   // true/false
console.log(result.confidence);   // 0.95
console.log(result.reasoning);    // "The agent successfully helped..."
```

### generatePersonaMessage()

Generates a contextual user message for continuing a conversation, optionally impersonating a persona.

```typescript
interface GeneratePersonaMessageInput {
  messages: Message[];
  persona?: Persona;      // Optional - generates generic user message if not provided
  scenario: Scenario;
  llmProviderId: string;
  model?: string;
}

interface GeneratePersonaMessageResult {
  content: string;
  rawResponse?: string;
}

function generatePersonaMessage(input: GeneratePersonaMessageInput): Promise<GeneratePersonaMessageResult>;
```

```typescript
const result = await generatePersonaMessage({
  messages: conversationHistory,
  persona: userPersona,  // Optional
  scenario: testScenario,
  llmProviderId: "provider-uuid",
});

console.log(result.content);  // "I'd like to reschedule my appointment to next Tuesday"
```

## Storage

Runs are stored in `data/runs.json` within the project directory.
