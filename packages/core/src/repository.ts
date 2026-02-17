import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getStorageDir } from "./storage.js";

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
 *
 * getStorageDir() is called on every operation (not cached)
 * because it can change at runtime via setStorageDir().
 */
export function createJsonRepository<T>(filename: string): Repository<T> {
  return {
    findAll(): T[] {
      const path = join(getStorageDir(), filename);
      if (!existsSync(path)) return [];
      return JSON.parse(readFileSync(path, "utf-8")) as T[];
    },

    saveAll(items: T[]): void {
      writeFileSync(
        join(getStorageDir(), filename),
        JSON.stringify(items, null, 2),
      );
    },
  };
}
