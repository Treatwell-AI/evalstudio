import { createJsonRepository, type Repository } from "./repository.js";
import type { ProjectContext } from "./project-resolver.js";

/**
 * Execution represents a batch of runs created together from a single eval run.
 * Each execution groups all runs (scenario/persona combinations) created at the same time.
 */
export interface Execution {
  /** Auto-increment integer ID (1, 2, 3, ...) */
  id: number;
  /** The eval that triggered this execution */
  evalId: string;
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

export function createExecutionModule(ctx: ProjectContext) {
  const repo: Repository<Execution> = createJsonRepository<Execution>("executions.json", ctx.dataDir);

  return {
    create(input: CreateExecutionInput): Execution {
      const executions = repo.findAll();
      const now = new Date().toISOString();

      const execution: Execution = {
        id: getNextId(executions),
        evalId: input.evalId,
        createdAt: now,
      };

      executions.push(execution);
      repo.saveAll(executions);

      return execution;
    },

    get(id: number): Execution | undefined {
      return repo.findAll().find((e) => e.id === id);
    },

    list(evalId?: string): Execution[] {
      const executions = repo.findAll();
      if (evalId) {
        return executions
          .filter((e) => e.evalId === evalId)
          .sort((a, b) => b.id - a.id);
      }
      return executions.sort((a, b) => b.id - a.id);
    },

    delete(id: number): boolean {
      const executions = repo.findAll();
      const index = executions.findIndex((e) => e.id === id);

      if (index === -1) {
        return false;
      }

      executions.splice(index, 1);
      repo.saveAll(executions);

      return true;
    },

    deleteByEval(evalId: string): number {
      const executions = repo.findAll();
      const filtered = executions.filter((e) => e.evalId !== evalId);
      const deletedCount = executions.length - filtered.length;

      if (deletedCount > 0) {
        repo.saveAll(filtered);
      }

      return deletedCount;
    },
  };
}

export type ExecutionModule = ReturnType<typeof createExecutionModule>;
