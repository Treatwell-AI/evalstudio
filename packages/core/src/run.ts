import { randomUUID } from "node:crypto";
import { getConnector } from "./connector.js";
import { getEval, type Message } from "./eval.js";
import { createExecution } from "./execution.js";
import { getPersona } from "./persona.js";
import { createJsonRepository, type Repository } from "./repository.js";
import { getScenario } from "./scenario.js";

/**
 * Run status types:
 * - queued: Waiting to be processed
 * - pending: Reserved for future use
 * - running: Currently executing
 * - completed: Finished (check result.success for pass/fail)
 * - error: System error occurred (retryable)
 */
export type RunStatus = "queued" | "pending" | "running" | "completed" | "error";

export interface RunResult {
  success: boolean;
  score?: number;
  reason?: string;
}

export interface RunMetadata {
  latencyMs?: number;
  tokenUsage?: {
    input: number;
    output: number;
  };
  [key: string]: unknown;
}

export interface Run {
  id: string;
  /** Eval ID (optional for playground runs) */
  evalId?: string;
  personaId?: string;
  scenarioId: string;
  /** Connector ID (for playground runs without eval) */
  connectorId?: string;
  /** Execution ID - groups runs created together in a single execution */
  executionId?: number;
  status: RunStatus;
  startedAt?: string;
  completedAt?: string;
  messages: Message[];
  output?: Record<string, unknown>;
  result?: RunResult;
  error?: string;
  metadata?: RunMetadata;
  /** Thread ID for LangGraph (regenerated on retry to start fresh thread) */
  threadId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRunInput {
  evalId: string;
}

export interface CreatePlaygroundRunInput {
  scenarioId: string;
  connectorId: string;
  personaId?: string;
}

export interface UpdateRunInput {
  status?: RunStatus;
  startedAt?: string;
  completedAt?: string;
  messages?: Message[];
  output?: Record<string, unknown>;
  result?: RunResult;
  error?: string;
  metadata?: RunMetadata;
  threadId?: string;
}

const repo: Repository<Run> = createJsonRepository<Run>("runs.json");

export function createRuns(input: CreateRunInput): Run[] {
  const evalItem = getEval(input.evalId);
  if (!evalItem) {
    throw new Error(`Eval with id "${input.evalId}" not found`);
  }

  // Validate all scenarios exist
  const scenarios = evalItem.scenarioIds.map((scenarioId) => {
    const scenario = getScenario(scenarioId);
    if (!scenario) {
      throw new Error(`Scenario with id "${scenarioId}" not found`);
    }
    return scenario;
  });

  if (scenarios.length === 0) {
    throw new Error("Eval has no scenarios configured");
  }

  // Collect all unique persona IDs and validate they exist
  const allPersonaIds = new Set<string>();
  for (const scenario of scenarios) {
    if (scenario.personaIds) {
      for (const personaId of scenario.personaIds) {
        allPersonaIds.add(personaId);
      }
    }
  }

  for (const personaId of allPersonaIds) {
    const persona = getPersona(personaId);
    if (!persona) {
      throw new Error(`Persona with id "${personaId}" not found`);
    }
  }

  const allRuns = repo.findAll();
  const now = new Date().toISOString();
  const createdRuns: Run[] = [];

  // Create an execution to group all runs created in this batch
  const execution = createExecution({
    evalId: input.evalId,
  });

  // Create runs for each scenario/persona combination
  for (const scenario of scenarios) {
    // Determine personas for this scenario: use scenario.personaIds, or [undefined] if empty
    const personaIds: (string | undefined)[] =
      scenario.personaIds && scenario.personaIds.length > 0
        ? scenario.personaIds
        : [undefined];

    for (const personaId of personaIds) {
      const run: Run = {
        id: randomUUID(),
        evalId: input.evalId,
        personaId,
        scenarioId: scenario.id,
        executionId: execution.id,
        status: "queued",
        messages: [],
        createdAt: now,
        updatedAt: now,
      };

      allRuns.push(run);
      createdRuns.push(run);
    }
  }

  repo.saveAll(allRuns);
  return createdRuns;
}

export function createRun(input: CreateRunInput): Run {
  const runs = createRuns(input);
  return runs[0];
}

/**
 * Creates a playground run for testing scenarios without an eval.
 * Used by the Scenario Playground to create runs directly.
 */
export function createPlaygroundRun(input: CreatePlaygroundRunInput): Run {
  const { scenarioId, connectorId, personaId } = input;

  // Validate scenario exists
  const scenario = getScenario(scenarioId);
  if (!scenario) {
    throw new Error(`Scenario with id "${scenarioId}" not found`);
  }

  // Validate connector exists
  const connector = getConnector(connectorId);
  if (!connector) {
    throw new Error(`Connector with id "${connectorId}" not found`);
  }

  // Validate persona if provided
  if (personaId) {
    const persona = getPersona(personaId);
    if (!persona) {
      throw new Error(`Persona with id "${personaId}" not found`);
    }
  }

  const allRuns = repo.findAll();
  const now = new Date().toISOString();

  const run: Run = {
    id: randomUUID(),
    // No evalId for playground runs
    scenarioId,
    connectorId,
    personaId,
    status: "queued",
    messages: [],
    createdAt: now,
    updatedAt: now,
  };

  allRuns.push(run);
  repo.saveAll(allRuns);

  return run;
}

export function getRun(id: string): Run | undefined {
  const runs = repo.findAll();
  return runs.find((r) => r.id === id);
}

export interface ListRunsOptions {
  evalId?: string;
  scenarioId?: string;
  status?: RunStatus;
  limit?: number;
}

export function listRuns(options?: ListRunsOptions): Run[];
export function listRuns(evalId?: string): Run[];
export function listRuns(
  evalIdOrOptions?: string | ListRunsOptions,
): Run[] {
  const runs = repo.findAll();

  // Handle new object-based API
  if (typeof evalIdOrOptions === "object" && evalIdOrOptions !== null) {
    const { evalId, scenarioId, status, limit } = evalIdOrOptions;

    let filtered = runs;

    if (evalId) {
      filtered = filtered.filter((r) => r.evalId === evalId);
    }

    if (scenarioId) {
      filtered = filtered.filter((r) => r.scenarioId === scenarioId);
    }

    if (status) {
      filtered = filtered.filter((r) => r.status === status);
    }

    // Sort by createdAt (oldest first for queue processing)
    filtered.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    if (limit && limit > 0) {
      filtered = filtered.slice(0, limit);
    }

    return filtered;
  }

  // Legacy API compatibility
  const evalId = evalIdOrOptions;

  if (evalId) {
    return runs.filter((r) => r.evalId === evalId);
  }

  return runs;
}

export function listRunsByEval(evalId: string): Run[] {
  const runs = repo.findAll();
  return runs
    .filter((r) => r.evalId === evalId)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
}

export function listRunsByScenario(scenarioId: string): Run[] {
  const runs = repo.findAll();
  return runs
    .filter((r) => r.scenarioId === scenarioId)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
}

export function listRunsByPersona(personaId: string): Run[] {
  const runs = repo.findAll();
  return runs
    .filter((r) => r.personaId === personaId)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
}

export function updateRun(id: string, input: UpdateRunInput): Run | undefined {
  const runs = repo.findAll();
  const index = runs.findIndex((r) => r.id === id);

  if (index === -1) {
    return undefined;
  }

  const run = runs[index];

  // Use "in" check to allow explicitly setting fields to undefined (to clear them)
  const updated: Run = {
    ...run,
    status: input.status ?? run.status,
    startedAt: "startedAt" in input ? input.startedAt : run.startedAt,
    completedAt: "completedAt" in input ? input.completedAt : run.completedAt,
    messages: input.messages ?? run.messages,
    output: "output" in input ? input.output : run.output,
    result: "result" in input ? input.result : run.result,
    error: "error" in input ? input.error : run.error,
    metadata: "metadata" in input ? input.metadata : run.metadata,
    threadId: "threadId" in input ? input.threadId : run.threadId,
    updatedAt: new Date().toISOString(),
  };

  runs[index] = updated;
  repo.saveAll(runs);

  return updated;
}

export function deleteRun(id: string): boolean {
  const runs = repo.findAll();
  const index = runs.findIndex((r) => r.id === id);

  if (index === -1) {
    return false;
  }

  runs.splice(index, 1);
  repo.saveAll(runs);

  return true;
}

export function deleteRunsByEval(evalId: string): number {
  const runs = repo.findAll();
  const filtered = runs.filter((r) => r.evalId !== evalId);
  const deletedCount = runs.length - filtered.length;

  if (deletedCount > 0) {
    repo.saveAll(filtered);
  }

  return deletedCount;
}

/**
 * Retries a failed run by resetting it to queued status.
 * Clears error, timing info, messages, and output.
 * Increments retryCount to ensure a fresh LangGraph thread is used.
 *
 * @param id - The run ID to retry
 * @returns The updated run, or undefined if not found
 * @throws Error if the run status is not "failed"
 */
export function retryRun(id: string): Run | undefined {
  const run = getRun(id);
  if (!run) {
    return undefined;
  }

  // Only allow retry on error runs (system failures)
  // Completed runs with result.success=false are evaluation failures and should not be retried
  if (run.status !== "error") {
    throw new Error(`Cannot retry run with status "${run.status}". Only runs with system errors can be retried.`);
  }

  const updates: UpdateRunInput = {
    status: "queued",
    error: undefined,
    startedAt: undefined,
    completedAt: undefined,
    result: undefined,
    metadata: undefined,
    output: undefined,
    // Always clear messages - they'll be rebuilt when the run starts
    messages: [],
    // Generate a new thread ID to start fresh in LangGraph
    threadId: randomUUID(),
  };

  return updateRun(id, updates);
}
