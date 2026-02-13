import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getStorageDir } from "./storage.js";

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

function getStoragePath(): string {
  return join(getStorageDir(), "executions.json");
}

function loadExecutions(): Execution[] {
  const path = getStoragePath();
  if (!existsSync(path)) {
    return [];
  }
  const data = readFileSync(path, "utf-8");
  return JSON.parse(data) as Execution[];
}

function saveExecutions(executions: Execution[]): void {
  const path = getStoragePath();
  writeFileSync(path, JSON.stringify(executions, null, 2));
}

/**
 * Get the next auto-increment ID for executions.
 */
function getNextId(executions: Execution[]): number {
  if (executions.length === 0) {
    return 1;
  }
  const maxId = Math.max(...executions.map((e) => e.id));
  return maxId + 1;
}

/**
 * Creates a new execution for a batch of runs.
 */
export function createExecution(input: CreateExecutionInput): Execution {
  const executions = loadExecutions();
  const now = new Date().toISOString();

  const execution: Execution = {
    id: getNextId(executions),
    evalId: input.evalId,
    createdAt: now,
  };

  executions.push(execution);
  saveExecutions(executions);

  return execution;
}

export function getExecution(id: number): Execution | undefined {
  const executions = loadExecutions();
  return executions.find((e) => e.id === id);
}

export function listExecutions(evalId?: string): Execution[] {
  const executions = loadExecutions();
  if (evalId) {
    return executions
      .filter((e) => e.evalId === evalId)
      .sort((a, b) => b.id - a.id);
  }
  return executions.sort((a, b) => b.id - a.id);
}

export function deleteExecution(id: number): boolean {
  const executions = loadExecutions();
  const index = executions.findIndex((e) => e.id === id);

  if (index === -1) {
    return false;
  }

  executions.splice(index, 1);
  saveExecutions(executions);

  return true;
}

export function deleteExecutionsByEval(evalId: string): number {
  const executions = loadExecutions();
  const filtered = executions.filter((e) => e.evalId !== evalId);
  const deletedCount = executions.length - filtered.length;

  if (deletedCount > 0) {
    saveExecutions(filtered);
  }

  return deletedCount;
}
