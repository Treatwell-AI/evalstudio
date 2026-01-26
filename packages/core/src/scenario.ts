import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getProject } from "./project.js";
import { getStorageDir } from "./storage.js";
import type { Message } from "./types.js";

export type { Message };

/**
 * Controls when failureCriteria is evaluated during a run:
 * - "every_turn": Check at every turn and stop immediately on failure (like successCriteria)
 * - "on_max_messages": Only check when maxMessages is reached without success
 */
export type FailureCriteriaMode = "every_turn" | "on_max_messages";

export interface Scenario {
  id: string;
  projectId: string;
  name: string;
  instructions?: string;
  messages?: Message[];
  /** Maximum number of messages in a conversation before stopping */
  maxMessages?: number;
  /** Criteria for determining if the agent passed (used by evaluator) */
  successCriteria?: string;
  /** Criteria for determining if the agent failed (used by evaluator) */
  failureCriteria?: string;
  /** When to check failureCriteria: "on_max_messages" (default) or "every_turn" */
  failureCriteriaMode?: FailureCriteriaMode;
  /** IDs of personas associated with this scenario (optional, can be empty) */
  personaIds?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateScenarioInput {
  projectId: string;
  name: string;
  instructions?: string;
  messages?: Message[];
  /** Maximum number of messages in a conversation before stopping */
  maxMessages?: number;
  /** Criteria for determining if the agent passed */
  successCriteria?: string;
  /** Criteria for determining if the agent failed */
  failureCriteria?: string;
  /** When to check failureCriteria: "on_max_messages" (default) or "every_turn" */
  failureCriteriaMode?: FailureCriteriaMode;
  /** IDs of personas associated with this scenario */
  personaIds?: string[];
}

export interface UpdateScenarioInput {
  name?: string;
  instructions?: string;
  messages?: Message[];
  /** Maximum number of messages in a conversation before stopping */
  maxMessages?: number;
  /** Criteria for determining if the agent passed */
  successCriteria?: string;
  /** Criteria for determining if the agent failed */
  failureCriteria?: string;
  /** When to check failureCriteria: "on_max_messages" (default) or "every_turn" */
  failureCriteriaMode?: FailureCriteriaMode;
  /** IDs of personas associated with this scenario */
  personaIds?: string[];
}

function getStoragePath(): string {
  return join(getStorageDir(), "scenarios.json");
}

function loadScenarios(): Scenario[] {
  const path = getStoragePath();
  if (!existsSync(path)) {
    return [];
  }
  const data = readFileSync(path, "utf-8");
  return JSON.parse(data) as Scenario[];
}

function saveScenarios(scenarios: Scenario[]): void {
  const path = getStoragePath();
  writeFileSync(path, JSON.stringify(scenarios, null, 2));
}

export function createScenario(input: CreateScenarioInput): Scenario {
  const project = getProject(input.projectId);
  if (!project) {
    throw new Error(`Project with id "${input.projectId}" not found`);
  }

  const scenarios = loadScenarios();

  if (
    scenarios.some(
      (s) => s.projectId === input.projectId && s.name === input.name
    )
  ) {
    throw new Error(
      `Scenario with name "${input.name}" already exists in this project`
    );
  }

  const now = new Date().toISOString();
  const scenario: Scenario = {
    id: randomUUID(),
    projectId: input.projectId,
    name: input.name,
    instructions: input.instructions,
    messages: input.messages,
    maxMessages: input.maxMessages,
    successCriteria: input.successCriteria,
    failureCriteria: input.failureCriteria,
    failureCriteriaMode: input.failureCriteriaMode,
    personaIds: input.personaIds,
    createdAt: now,
    updatedAt: now,
  };

  scenarios.push(scenario);
  saveScenarios(scenarios);

  return scenario;
}

export function getScenario(id: string): Scenario | undefined {
  const scenarios = loadScenarios();
  return scenarios.find((s) => s.id === id);
}

export function getScenarioByName(
  projectId: string,
  name: string
): Scenario | undefined {
  const scenarios = loadScenarios();
  return scenarios.find((s) => s.projectId === projectId && s.name === name);
}

export function listScenarios(projectId?: string): Scenario[] {
  const scenarios = loadScenarios();
  if (projectId) {
    return scenarios.filter((s) => s.projectId === projectId);
  }
  return scenarios;
}

export function updateScenario(
  id: string,
  input: UpdateScenarioInput
): Scenario | undefined {
  const scenarios = loadScenarios();
  const index = scenarios.findIndex((s) => s.id === id);

  if (index === -1) {
    return undefined;
  }

  const scenario = scenarios[index];

  if (
    input.name &&
    scenarios.some(
      (s) =>
        s.projectId === scenario.projectId && s.name === input.name && s.id !== id
    )
  ) {
    throw new Error(
      `Scenario with name "${input.name}" already exists in this project`
    );
  }

  const updated: Scenario = {
    ...scenario,
    name: input.name ?? scenario.name,
    instructions: input.instructions ?? scenario.instructions,
    messages: input.messages ?? scenario.messages,
    maxMessages: input.maxMessages ?? scenario.maxMessages,
    successCriteria: input.successCriteria ?? scenario.successCriteria,
    failureCriteria: input.failureCriteria ?? scenario.failureCriteria,
    failureCriteriaMode: input.failureCriteriaMode ?? scenario.failureCriteriaMode,
    personaIds: input.personaIds ?? scenario.personaIds,
    updatedAt: new Date().toISOString(),
  };

  scenarios[index] = updated;
  saveScenarios(scenarios);

  return updated;
}

export function deleteScenario(id: string): boolean {
  const scenarios = loadScenarios();
  const index = scenarios.findIndex((s) => s.id === id);

  if (index === -1) {
    return false;
  }

  scenarios.splice(index, 1);
  saveScenarios(scenarios);

  return true;
}

export function deleteScenariosByProject(projectId: string): number {
  const scenarios = loadScenarios();
  const filtered = scenarios.filter((s) => s.projectId !== projectId);
  const deletedCount = scenarios.length - filtered.length;

  if (deletedCount > 0) {
    saveScenarios(filtered);
  }

  return deletedCount;
}
