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
  findAll(): Promise<T[]>;
  saveAll(items: T[]): Promise<void>;
}

/**
 * JSON file-based repository implementation.
 * Takes an explicit dataDir — no global state.
 */
export function createJsonRepository<T>(filename: string, dataDir: string): Repository<T> {
  return {
    async findAll(): Promise<T[]> {
      const path = join(dataDir, filename);
      if (!existsSync(path)) return [];
      return JSON.parse(readFileSync(path, "utf-8")) as T[];
    },

    async saveAll(items: T[]): Promise<void> {
      writeFileSync(
        join(dataDir, filename),
        JSON.stringify(items, null, 2),
      );
    },
  };
}
