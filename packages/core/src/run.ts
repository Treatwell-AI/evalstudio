import { randomUUID } from "node:crypto";
import { createConnectorModule } from "./connector.js";
import { createEvalModule, type Message } from "./eval.js";
import { createExecutionModule } from "./execution.js";
import { createPersonaModule } from "./persona.js";
import { createJsonRepository, type Repository } from "./repository.js";
import { createScenarioModule } from "./scenario.js";
import type { ProjectContext } from "./project-resolver.js";

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

export function createRunModule(ctx: ProjectContext) {
  const repo: Repository<Run> = createJsonRepository<Run>("runs.json", ctx.dataDir);

  return {
    createMany(input: CreateRunInput): Run[] {
      const evals = createEvalModule(ctx);
      const scenarioMod = createScenarioModule(ctx);
      const personaMod = createPersonaModule(ctx);
      const executionMod = createExecutionModule(ctx);

      const evalItem = evals.get(input.evalId);
      if (!evalItem) {
        throw new Error(`Eval with id "${input.evalId}" not found`);
      }

      const scenarios = evalItem.scenarioIds.map((scenarioId) => {
        const scenario = scenarioMod.get(scenarioId);
        if (!scenario) {
          throw new Error(`Scenario with id "${scenarioId}" not found`);
        }
        return scenario;
      });

      if (scenarios.length === 0) {
        throw new Error("Eval has no scenarios configured");
      }

      const allPersonaIds = new Set<string>();
      for (const scenario of scenarios) {
        if (scenario.personaIds) {
          for (const personaId of scenario.personaIds) {
            allPersonaIds.add(personaId);
          }
        }
      }

      for (const personaId of allPersonaIds) {
        const persona = personaMod.get(personaId);
        if (!persona) {
          throw new Error(`Persona with id "${personaId}" not found`);
        }
      }

      const allRuns = repo.findAll();
      const now = new Date().toISOString();
      const createdRuns: Run[] = [];

      const execution = executionMod.create({ evalId: input.evalId });

      for (const scenario of scenarios) {
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
    },

    create(input: CreateRunInput): Run {
      const runs = this.createMany(input);
      return runs[0];
    },

    createPlayground(input: CreatePlaygroundRunInput): Run {
      const { scenarioId, connectorId, personaId } = input;

      const scenarioMod = createScenarioModule(ctx);
      const connectorMod = createConnectorModule(ctx);
      const personaMod = createPersonaModule(ctx);

      const scenario = scenarioMod.get(scenarioId);
      if (!scenario) {
        throw new Error(`Scenario with id "${scenarioId}" not found`);
      }

      const connector = connectorMod.get(connectorId);
      if (!connector) {
        throw new Error(`Connector with id "${connectorId}" not found`);
      }

      if (personaId) {
        const persona = personaMod.get(personaId);
        if (!persona) {
          throw new Error(`Persona with id "${personaId}" not found`);
        }
      }

      const allRuns = repo.findAll();
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
      repo.saveAll(allRuns);

      return run;
    },

    get(id: string): Run | undefined {
      return repo.findAll().find((r) => r.id === id);
    },

    list(options?: ListRunsOptions): Run[] {
      const runs = repo.findAll();

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

    listByEval(evalId: string): Run[] {
      return repo.findAll()
        .filter((r) => r.evalId === evalId)
        .sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
    },

    listByScenario(scenarioId: string): Run[] {
      return repo.findAll()
        .filter((r) => r.scenarioId === scenarioId)
        .sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
    },

    listByPersona(personaId: string): Run[] {
      return repo.findAll()
        .filter((r) => r.personaId === personaId)
        .sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
    },

    update(id: string, input: UpdateRunInput): Run | undefined {
      const runs = repo.findAll();
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
      repo.saveAll(runs);

      return updated;
    },

    delete(id: string): boolean {
      const runs = repo.findAll();
      const index = runs.findIndex((r) => r.id === id);

      if (index === -1) return false;

      runs.splice(index, 1);
      repo.saveAll(runs);

      return true;
    },

    deleteByEval(evalId: string): number {
      const runs = repo.findAll();
      const filtered = runs.filter((r) => r.evalId !== evalId);
      const deletedCount = runs.length - filtered.length;

      if (deletedCount > 0) {
        repo.saveAll(filtered);
      }

      return deletedCount;
    },

    retry(id: string): Run | undefined {
      const run = this.get(id);
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
