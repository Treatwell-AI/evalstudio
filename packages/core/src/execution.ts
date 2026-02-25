import type { Repository } from "./repository.js";

/**
 * Execution represents a batch of runs created together from a single eval run.
 * Each execution groups all runs (scenario/persona combinations) created at the same time.
 */
export interface Execution {
  /** Auto-increment integer ID (1, 2, 3, ...) */
  id: number;
  /** The eval that triggered this execution */
  evalId?: string;
  /** When this execution was created */
  createdAt: string;
}

export interface CreateExecutionInput {
  evalId: string;
}

export function createExecutionModule(repo: Repository<Execution>) {
  return {
    async create(input: CreateExecutionInput): Promise<Execution> {
      const maxId = await repo.maxId();
      const now = new Date().toISOString();

      const execution: Execution = {
        id: maxId + 1,
        evalId: input.evalId,
        createdAt: now,
      };

      await repo.save(execution);
      return execution;
    },

    async get(id: number): Promise<Execution | undefined> {
      return repo.findById(id);
    },

    async list(evalId?: string): Promise<Execution[]> {
      const executions = evalId
        ? await repo.findBy({ evalId })
        : await repo.findAll();
      return executions.sort((a, b) => b.id - a.id);
    },

    async delete(id: number): Promise<boolean> {
      return repo.deleteById(id);
    },

};
}

export type ExecutionModule = ReturnType<typeof createExecutionModule>;
