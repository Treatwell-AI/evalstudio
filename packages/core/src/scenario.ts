import { randomUUID } from "node:crypto";
import type { Repository } from "./repository.js";
import type { Message } from "./types.js";
import type { ScenarioEvaluator } from "./evaluator.js";

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
  /** Custom evaluators (assertions and/or metrics) that run alongside LLM-as-judge. */
  evaluators?: ScenarioEvaluator[];
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
  evaluators?: ScenarioEvaluator[];
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
  evaluators?: ScenarioEvaluator[];
  personaIds?: string[];
}

export function createScenarioModule(repo: Repository<Scenario>) {
  return {
    async create(input: CreateScenarioInput): Promise<Scenario> {
      const duplicates = await repo.findBy({ name: input.name });
      if (duplicates.length > 0) {
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
        evaluators: input.evaluators,
        personaIds: input.personaIds,
        createdAt: now,
        updatedAt: now,
      };

      await repo.save(scenario);
      return scenario;
    },

    async get(id: string): Promise<Scenario | undefined> {
      return repo.findById(id);
    },

    async getByName(name: string): Promise<Scenario | undefined> {
      const results = await repo.findBy({ name });
      return results[0];
    },

    async list(): Promise<Scenario[]> {
      return repo.findAll();
    },

    async update(id: string, input: UpdateScenarioInput): Promise<Scenario | undefined> {
      const scenario = await repo.findById(id);
      if (!scenario) return undefined;

      if (input.name) {
        const duplicates = await repo.findBy({ name: input.name });
        if (duplicates.some((s) => s.id !== id)) {
          throw new Error(`Scenario with name "${input.name}" already exists`);
        }
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
        evaluators: input.evaluators ?? scenario.evaluators,
        personaIds: input.personaIds ?? scenario.personaIds,
        updatedAt: new Date().toISOString(),
      };

      await repo.save(updated);
      return updated;
    },

    async delete(id: string): Promise<boolean> {
      return repo.deleteById(id);
    },
  };
}

export type ScenarioModule = ReturnType<typeof createScenarioModule>;
