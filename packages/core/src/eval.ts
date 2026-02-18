import { randomUUID } from "node:crypto";
import { createJsonRepository, type Repository } from "./repository.js";
import type { ProjectContext } from "./project-resolver.js";
import { createConnectorModule } from "./connector.js";
import { createScenarioModule, type FailureCriteriaMode } from "./scenario.js";
import { createRunModule } from "./run.js";
import type { Message } from "./types.js";

export type { Message };

export interface Eval {
  id: string;
  name: string;
  input: Message[];
  scenarioIds: string[];
  connectorId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEvalInput {
  name: string;
  input?: Message[];
  scenarioIds: string[];
  connectorId: string;
}

export interface UpdateEvalInput {
  name?: string;
  input?: Message[];
  scenarioIds?: string[];
  connectorId?: string;
}

export interface ScenarioSummary {
  id: string;
  name: string;
  instructions?: string;
  messages?: Message[];
  maxMessages?: number;
  successCriteria?: string;
  failureCriteria?: string;
  failureCriteriaMode?: FailureCriteriaMode;
}

export interface EvalWithRelations extends Eval {
  scenarios: ScenarioSummary[];
  connector?: {
    id: string;
    name: string;
    type: string;
    baseUrl: string;
  };
}

export function createEvalModule(ctx: ProjectContext) {
  const repo: Repository<Eval> = createJsonRepository<Eval>("evals.json", ctx.dataDir);
  const connectors = createConnectorModule(ctx);
  const scenarios = createScenarioModule(ctx);

  return {
    create(input: CreateEvalInput): Eval {
      const connector = connectors.get(input.connectorId);
      if (!connector) {
        throw new Error(`Connector with id "${input.connectorId}" not found`);
      }

      if (!input.scenarioIds || input.scenarioIds.length === 0) {
        throw new Error("At least one scenario is required");
      }

      for (const scenarioId of input.scenarioIds) {
        const scenario = scenarios.get(scenarioId);
        if (!scenario) {
          throw new Error(`Scenario with id "${scenarioId}" not found`);
        }
      }

      const evals = repo.findAll();
      const now = new Date().toISOString();
      const evalItem: Eval = {
        id: randomUUID(),
        name: input.name,
        input: input.input ?? [],
        scenarioIds: input.scenarioIds,
        connectorId: input.connectorId,
        createdAt: now,
        updatedAt: now,
      };

      evals.push(evalItem);
      repo.saveAll(evals);

      return evalItem;
    },

    get(id: string): Eval | undefined {
      return repo.findAll().find((e) => e.id === id);
    },

    getByScenario(scenarioId: string): Eval | undefined {
      return repo.findAll().find((e) => e.scenarioIds.includes(scenarioId));
    },

    list(): Eval[] {
      return repo.findAll();
    },

    getWithRelations(id: string): EvalWithRelations | undefined {
      const evalItem = this.get(id);
      if (!evalItem) return undefined;

      const scenarioList: ScenarioSummary[] = [];
      for (const scenarioId of evalItem.scenarioIds) {
        const scenario = scenarios.get(scenarioId);
        if (!scenario) continue;
        scenarioList.push({
          id: scenario.id,
          name: scenario.name,
          instructions: scenario.instructions,
          messages: scenario.messages,
          maxMessages: scenario.maxMessages,
          successCriteria: scenario.successCriteria,
          failureCriteria: scenario.failureCriteria,
          failureCriteriaMode: scenario.failureCriteriaMode,
        });
      }

      if (scenarioList.length === 0) return undefined;

      const result: EvalWithRelations = { ...evalItem, scenarios: scenarioList };

      const connector = connectors.get(evalItem.connectorId);
      if (connector) {
        result.connector = {
          id: connector.id,
          name: connector.name,
          type: connector.type,
          baseUrl: connector.baseUrl,
        };
      }

      return result;
    },

    update(id: string, input: UpdateEvalInput): Eval | undefined {
      const evals = repo.findAll();
      const index = evals.findIndex((e) => e.id === id);

      if (index === -1) return undefined;

      if (input.connectorId) {
        const connector = connectors.get(input.connectorId);
        if (!connector) {
          throw new Error(`Connector with id "${input.connectorId}" not found`);
        }
      }

      if (input.scenarioIds) {
        if (input.scenarioIds.length === 0) {
          throw new Error("At least one scenario is required");
        }
        for (const scenarioId of input.scenarioIds) {
          const scenario = scenarios.get(scenarioId);
          if (!scenario) {
            throw new Error(`Scenario with id "${scenarioId}" not found`);
          }
        }
      }

      const evalItem = evals[index];
      const updated: Eval = {
        ...evalItem,
        name: input.name ?? evalItem.name,
        input: input.input ?? evalItem.input,
        scenarioIds: input.scenarioIds ?? evalItem.scenarioIds,
        connectorId: input.connectorId ?? evalItem.connectorId,
        updatedAt: new Date().toISOString(),
      };

      evals[index] = updated;
      repo.saveAll(evals);

      return updated;
    },

    delete(id: string): boolean {
      const evals = repo.findAll();
      const index = evals.findIndex((e) => e.id === id);

      if (index === -1) return false;

      // Delete associated runs first
      const runs = createRunModule(ctx);
      runs.deleteByEval(id);

      evals.splice(index, 1);
      repo.saveAll(evals);

      return true;
    },
  };
}

export type EvalModule = ReturnType<typeof createEvalModule>;
