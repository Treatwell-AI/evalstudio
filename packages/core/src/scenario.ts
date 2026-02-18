import { randomUUID } from "node:crypto";
import { createJsonRepository, type Repository } from "./repository.js";
import type { ProjectContext } from "./project-resolver.js";
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
  name: string;
  instructions?: string;
  messages?: Message[];
  maxMessages?: number;
  successCriteria?: string;
  failureCriteria?: string;
  failureCriteriaMode?: FailureCriteriaMode;
  personaIds?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateScenarioInput {
  name: string;
  instructions?: string;
  messages?: Message[];
  maxMessages?: number;
  successCriteria?: string;
  failureCriteria?: string;
  failureCriteriaMode?: FailureCriteriaMode;
  personaIds?: string[];
}

export interface UpdateScenarioInput {
  name?: string;
  instructions?: string;
  messages?: Message[];
  maxMessages?: number;
  successCriteria?: string;
  failureCriteria?: string;
  failureCriteriaMode?: FailureCriteriaMode;
  personaIds?: string[];
}

export function createScenarioModule(ctx: ProjectContext) {
  const repo: Repository<Scenario> = createJsonRepository<Scenario>("scenarios.json", ctx.dataDir);

  return {
    create(input: CreateScenarioInput): Scenario {
      const scenarios = repo.findAll();

      if (scenarios.some((s) => s.name === input.name)) {
        throw new Error(`Scenario with name "${input.name}" already exists`);
      }

      const now = new Date().toISOString();
      const scenario: Scenario = {
        id: randomUUID(),
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
      repo.saveAll(scenarios);

      return scenario;
    },

    get(id: string): Scenario | undefined {
      return repo.findAll().find((s) => s.id === id);
    },

    getByName(name: string): Scenario | undefined {
      return repo.findAll().find((s) => s.name === name);
    },

    list(): Scenario[] {
      return repo.findAll();
    },

    update(id: string, input: UpdateScenarioInput): Scenario | undefined {
      const scenarios = repo.findAll();
      const index = scenarios.findIndex((s) => s.id === id);

      if (index === -1) {
        return undefined;
      }

      const scenario = scenarios[index];

      if (
        input.name &&
        scenarios.some((s) => s.name === input.name && s.id !== id)
      ) {
        throw new Error(`Scenario with name "${input.name}" already exists`);
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
      repo.saveAll(scenarios);

      return updated;
    },

    delete(id: string): boolean {
      const scenarios = repo.findAll();
      const index = scenarios.findIndex((s) => s.id === id);

      if (index === -1) {
        return false;
      }

      scenarios.splice(index, 1);
      repo.saveAll(scenarios);

      return true;
    },
  };
}

export type ScenarioModule = ReturnType<typeof createScenarioModule>;
