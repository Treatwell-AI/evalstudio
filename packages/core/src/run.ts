import { randomUUID } from "node:crypto";
import type { Repository } from "./repository.js";
import type { EvalModule, Message } from "./eval.js";
import type { ScenarioModule } from "./scenario.js";
import type { PersonaModule } from "./persona.js";
import type { ConnectorModule } from "./connector.js";
import type { ExecutionModule } from "./execution.js";

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
  evalId?: string;
  personaId?: string;
  scenarioId: string;
  connectorId?: string;
  executionId?: number;
  status: RunStatus;
  startedAt?: string;
  completedAt?: string;
  messages: Message[];
  output?: Record<string, unknown>;
  result?: RunResult;
  error?: string;
  metadata?: RunMetadata;
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

export interface ListRunsOptions {
  evalId?: string;
  scenarioId?: string;
  status?: RunStatus;
  limit?: number;
}

export interface RunModuleDeps {
  evals: EvalModule;
  scenarios: ScenarioModule;
  personas: PersonaModule;
  connectors: ConnectorModule;
  executions: ExecutionModule;
}

export function createRunModule(repo: Repository<Run>, deps: RunModuleDeps) {
  const { evals, scenarios, personas, connectors, executions } = deps;

  return {
    async createMany(input: CreateRunInput): Promise<Run[]> {
      const evalItem = await evals.get(input.evalId);
      if (!evalItem) {
        throw new Error(`Eval with id "${input.evalId}" not found`);
      }

      const scenarioList = await Promise.all(
        evalItem.scenarioIds.map(async (scenarioId) => {
          const scenario = await scenarios.get(scenarioId);
          if (!scenario) {
            throw new Error(`Scenario with id "${scenarioId}" not found`);
          }
          return scenario;
        }),
      );

      if (scenarioList.length === 0) {
        throw new Error("Eval has no scenarios configured");
      }

      const allPersonaIds = new Set<string>();
      for (const scenario of scenarioList) {
        if (scenario.personaIds) {
          for (const personaId of scenario.personaIds) {
            allPersonaIds.add(personaId);
          }
        }
      }

      for (const personaId of allPersonaIds) {
        const persona = await personas.get(personaId);
        if (!persona) {
          throw new Error(`Persona with id "${personaId}" not found`);
        }
      }

      const allRuns = await repo.findAll();
      const now = new Date().toISOString();
      const createdRuns: Run[] = [];

      const execution = await executions.create({ evalId: input.evalId });

      for (const scenario of scenarioList) {
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

      await repo.saveAll(allRuns);
      return createdRuns;
    },

    async create(input: CreateRunInput): Promise<Run> {
      const runs = await this.createMany(input);
      return runs[0];
    },

    async createPlayground(input: CreatePlaygroundRunInput): Promise<Run> {
      const { scenarioId, connectorId, personaId } = input;

      const scenario = await scenarios.get(scenarioId);
      if (!scenario) {
        throw new Error(`Scenario with id "${scenarioId}" not found`);
      }

      const connector = await connectors.get(connectorId);
      if (!connector) {
        throw new Error(`Connector with id "${connectorId}" not found`);
      }

      if (personaId) {
        const persona = await personas.get(personaId);
        if (!persona) {
          throw new Error(`Persona with id "${personaId}" not found`);
        }
      }

      const allRuns = await repo.findAll();
      const now = new Date().toISOString();

      const run: Run = {
        id: randomUUID(),
        scenarioId,
        connectorId,
        personaId,
        status: "queued",
        messages: [],
        createdAt: now,
        updatedAt: now,
      };

      allRuns.push(run);
      await repo.saveAll(allRuns);

      return run;
    },

    async get(id: string): Promise<Run | undefined> {
      return (await repo.findAll()).find((r) => r.id === id);
    },

    async list(options?: ListRunsOptions): Promise<Run[]> {
      const runs = await repo.findAll();

      if (!options) return runs;

      let filtered = runs;

      if (options.evalId) {
        filtered = filtered.filter((r) => r.evalId === options.evalId);
      }

      if (options.scenarioId) {
        filtered = filtered.filter((r) => r.scenarioId === options.scenarioId);
      }

      if (options.status) {
        filtered = filtered.filter((r) => r.status === options.status);
      }

      filtered.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );

      if (options.limit && options.limit > 0) {
        filtered = filtered.slice(0, options.limit);
      }

      return filtered;
    },

    async listByEval(evalId: string): Promise<Run[]> {
      return (await repo.findAll())
        .filter((r) => r.evalId === evalId)
        .sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
    },

    async listByScenario(scenarioId: string): Promise<Run[]> {
      return (await repo.findAll())
        .filter((r) => r.scenarioId === scenarioId)
        .sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
    },

    async listByPersona(personaId: string): Promise<Run[]> {
      return (await repo.findAll())
        .filter((r) => r.personaId === personaId)
        .sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
    },

    async update(id: string, input: UpdateRunInput): Promise<Run | undefined> {
      const runs = await repo.findAll();
      const index = runs.findIndex((r) => r.id === id);

      if (index === -1) return undefined;

      const run = runs[index];
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
      await repo.saveAll(runs);

      return updated;
    },

    async delete(id: string): Promise<boolean> {
      const runs = await repo.findAll();
      const index = runs.findIndex((r) => r.id === id);

      if (index === -1) return false;

      runs.splice(index, 1);
      await repo.saveAll(runs);

      return true;
    },

    async deleteByEval(evalId: string): Promise<number> {
      const runs = await repo.findAll();
      const filtered = runs.filter((r) => r.evalId !== evalId);
      const deletedCount = runs.length - filtered.length;

      if (deletedCount > 0) {
        await repo.saveAll(filtered);
      }

      return deletedCount;
    },

    async retry(id: string): Promise<Run | undefined> {
      const run = await this.get(id);
      if (!run) return undefined;

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
        messages: [],
        threadId: randomUUID(),
      };

      return this.update(id, updates);
    },
  };
}

export type RunModule = ReturnType<typeof createRunModule>;
