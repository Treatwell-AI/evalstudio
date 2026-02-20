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

function getNextId(executions: Execution[]): number {
  if (executions.length === 0) {
    return 1;
  }
  const maxId = Math.max(...executions.map((e) => e.id));
  return maxId + 1;
}

export function createExecutionModule(repo: Repository<Execution>) {
  return {
    async create(input: CreateExecutionInput): Promise<Execution> {
      const executions = await repo.findAll();
      const now = new Date().toISOString();

      const execution: Execution = {
        id: getNextId(executions),
        evalId: input.evalId,
        createdAt: now,
      };

      executions.push(execution);
      await repo.saveAll(executions);

      return execution;
    },

    async get(id: number): Promise<Execution | undefined> {
      return (await repo.findAll()).find((e) => e.id === id);
    },

    async list(evalId?: string): Promise<Execution[]> {
      const executions = await repo.findAll();
      if (evalId) {
        return executions
          .filter((e) => e.evalId === evalId)
          .sort((a, b) => b.id - a.id);
      }
      return executions.sort((a, b) => b.id - a.id);
    },

    async delete(id: number): Promise<boolean> {
      const executions = await repo.findAll();
      const index = executions.findIndex((e) => e.id === id);

      if (index === -1) {
        return false;
      }

      executions.splice(index, 1);
      await repo.saveAll(executions);

      return true;
    },

};
}

export type ExecutionModule = ReturnType<typeof createExecutionModule>;
