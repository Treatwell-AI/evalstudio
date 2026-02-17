import { randomUUID } from "node:crypto";
import { getConnector } from "./connector.js";
import { createJsonRepository, type Repository } from "./repository.js";
import { deleteRunsByEval } from "./run.js";
import { getScenario } from "./scenario.js";
import type { Message } from "./types.js";
import type { FailureCriteriaMode } from "./scenario.js";

export type { Message };

export interface Eval {
  id: string;
  /** Display name for the eval */
  name: string;
  /** Input messages for the eval */
  input: Message[];
  /** Required: Scenarios define the test contexts and evaluation criteria */
  scenarioIds: string[];
  /** The connector to use for running this eval (required) */
  connectorId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEvalInput {
  /** Display name for the eval */
  name: string;
  /** Initial input messages */
  input?: Message[];
  /** Required: Scenarios define the test contexts and evaluation criteria */
  scenarioIds: string[];
  /** The connector to use for running this eval (required) */
  connectorId: string;
}

export interface UpdateEvalInput {
  /** Display name for the eval */
  name?: string;
  /** Input messages */
  input?: Message[];
  /** Scenarios define the test contexts and evaluation criteria */
  scenarioIds?: string[];
  /** The connector to use for running this eval */
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

const repo: Repository<Eval> = createJsonRepository<Eval>("evals.json");

export function createEval(input: CreateEvalInput): Eval {
  // Validate connector (required)
  const connector = getConnector(input.connectorId);
  if (!connector) {
    throw new Error(`Connector with id "${input.connectorId}" not found`);
  }

  // Validate scenarios (required, at least one)
  if (!input.scenarioIds || input.scenarioIds.length === 0) {
    throw new Error("At least one scenario is required");
  }

  for (const scenarioId of input.scenarioIds) {
    const scenario = getScenario(scenarioId);
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
}

export function getEval(id: string): Eval | undefined {
  const evals = repo.findAll();
  return evals.find((e) => e.id === id);
}

export function getEvalByScenario(scenarioId: string): Eval | undefined {
  const evals = repo.findAll();
  return evals.find((e) => e.scenarioIds.includes(scenarioId));
}

export function listEvals(): Eval[] {
  return repo.findAll();
}

export function getEvalWithRelations(
  id: string
): EvalWithRelations | undefined {
  const evalItem = getEval(id);
  if (!evalItem) {
    return undefined;
  }

  // Fetch all scenarios (at least one is required)
  const scenarios: ScenarioSummary[] = [];
  for (const scenarioId of evalItem.scenarioIds) {
    const scenario = getScenario(scenarioId);
    if (!scenario) {
      continue; // Skip missing scenarios (shouldn't happen in normal operation)
    }
    scenarios.push({
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

  if (scenarios.length === 0) {
    return undefined; // At least one scenario must exist for a valid eval
  }

  const result: EvalWithRelations = {
    ...evalItem,
    scenarios,
  };

  // Always populate connector (it's required on Eval)
  const connector = getConnector(evalItem.connectorId);
  if (connector) {
    result.connector = {
      id: connector.id,
      name: connector.name,
      type: connector.type,
      baseUrl: connector.baseUrl,
    };
  }

  return result;
}

export function updateEval(
  id: string,
  input: UpdateEvalInput
): Eval | undefined {
  const evals = repo.findAll();
  const index = evals.findIndex((e) => e.id === id);

  if (index === -1) {
    return undefined;
  }

  // Validate connector if being updated
  if (input.connectorId) {
    const connector = getConnector(input.connectorId);
    if (!connector) {
      throw new Error(`Connector with id "${input.connectorId}" not found`);
    }
  }

  // Validate scenarios if being updated
  if (input.scenarioIds) {
    if (input.scenarioIds.length === 0) {
      throw new Error("At least one scenario is required");
    }
    for (const scenarioId of input.scenarioIds) {
      const scenario = getScenario(scenarioId);
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
}

export function deleteEval(id: string): boolean {
  const evals = repo.findAll();
  const index = evals.findIndex((e) => e.id === id);

  if (index === -1) {
    return false;
  }

  // Delete associated runs first
  deleteRunsByEval(id);

  evals.splice(index, 1);
  repo.saveAll(evals);

  return true;
}
