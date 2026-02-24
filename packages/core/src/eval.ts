import { randomUUID } from "node:crypto";
import type { Repository } from "./repository.js";
import type { ConnectorModule } from "./connector.js";
import type { ScenarioModule, FailureCriteriaMode } from "./scenario.js";
import type { Message } from "./types.js";

export type { Message };

export interface Eval {
  id: string;
  name: string;
  scenarioIds: string[];
  connectorId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEvalInput {
  name: string;
  scenarioIds: string[];
  connectorId: string;
}

export interface UpdateEvalInput {
  name?: string;
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

export interface EvalModuleDeps {
  scenarios: ScenarioModule;
  connectors: ConnectorModule;
}

export function createEvalModule(repo: Repository<Eval>, deps: EvalModuleDeps) {
  const { scenarios, connectors } = deps;

  return {
    async create(input: CreateEvalInput): Promise<Eval> {
      const connector = await connectors.get(input.connectorId);
      if (!connector) {
        throw new Error(`Connector with id "${input.connectorId}" not found`);
      }

      if (!input.scenarioIds || input.scenarioIds.length === 0) {
        throw new Error("At least one scenario is required");
      }

      for (const scenarioId of input.scenarioIds) {
        const scenario = await scenarios.get(scenarioId);
        if (!scenario) {
          throw new Error(`Scenario with id "${scenarioId}" not found`);
        }
      }

      const evals = await repo.findAll();
      const now = new Date().toISOString();
      const evalItem: Eval = {
        id: randomUUID(),
        name: input.name,
        scenarioIds: input.scenarioIds,
        connectorId: input.connectorId,
        createdAt: now,
        updatedAt: now,
      };

      evals.push(evalItem);
      await repo.saveAll(evals);

      return evalItem;
    },

    async get(id: string): Promise<Eval | undefined> {
      return (await repo.findAll()).find((e) => e.id === id);
    },

    async getByScenario(scenarioId: string): Promise<Eval | undefined> {
      return (await repo.findAll()).find((e) => e.scenarioIds.includes(scenarioId));
    },

    async list(): Promise<Eval[]> {
      return repo.findAll();
    },

    async getWithRelations(id: string): Promise<EvalWithRelations | undefined> {
      const evalItem = await this.get(id);
      if (!evalItem) return undefined;

      const scenarioList: ScenarioSummary[] = [];
      for (const scenarioId of evalItem.scenarioIds) {
        const scenario = await scenarios.get(scenarioId);
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

      const connector = evalItem.connectorId
        ? await connectors.get(evalItem.connectorId)
        : undefined;
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

    async update(id: string, input: UpdateEvalInput): Promise<Eval | undefined> {
      const evals = await repo.findAll();
      const index = evals.findIndex((e) => e.id === id);

      if (index === -1) return undefined;

      if (input.connectorId) {
        const connector = await connectors.get(input.connectorId);
        if (!connector) {
          throw new Error(`Connector with id "${input.connectorId}" not found`);
        }
      }

      if (input.scenarioIds) {
        if (input.scenarioIds.length === 0) {
          throw new Error("At least one scenario is required");
        }
        for (const scenarioId of input.scenarioIds) {
          const scenario = await scenarios.get(scenarioId);
          if (!scenario) {
            throw new Error(`Scenario with id "${scenarioId}" not found`);
          }
        }
      }

      const evalItem = evals[index];
      const updated: Eval = {
        ...evalItem,
        name: input.name ?? evalItem.name,
        scenarioIds: input.scenarioIds ?? evalItem.scenarioIds,
        connectorId: input.connectorId ?? evalItem.connectorId,
        updatedAt: new Date().toISOString(),
      };

      evals[index] = updated;
      await repo.saveAll(evals);

      return updated;
    },

    async delete(id: string): Promise<boolean> {
      const evals = await repo.findAll();
      const index = evals.findIndex((e) => e.id === id);

      if (index === -1) return false;

      evals.splice(index, 1);
      await repo.saveAll(evals);

      return true;
    },
  };
}

export type EvalModule = ReturnType<typeof createEvalModule>;
