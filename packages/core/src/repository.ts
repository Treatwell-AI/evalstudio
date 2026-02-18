import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Generic repository interface for entity storage.
 * Provides low-level collection I/O operations.
 *
 * Entity-specific business logic (validation, uniqueness checks,
 * cascade deletes, relational queries) belongs in the entity modules.
 */
export interface Repository<T> {
  findAll(): T[];
  saveAll(items: T[]): void;
}

/**
 * JSON file-based repository implementation.
 * Takes an explicit dataDir — no global state.
 */
export function createJsonRepository<T>(filename: string, dataDir: string): Repository<T> {
  return {
    findAll(): T[] {
      const path = join(dataDir, filename);
      if (!existsSync(path)) return [];
      return JSON.parse(readFileSync(path, "utf-8")) as T[];
    },

    saveAll(items: T[]): void {
      writeFileSync(
        join(dataDir, filename),
        JSON.stringify(items, null, 2),
      );
    },
  };
}
