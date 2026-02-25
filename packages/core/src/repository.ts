import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Generic repository interface for entity storage.
 * Provides both collection-level and targeted I/O operations.
 *
 * Entity-specific business logic (validation, uniqueness checks,
 * cascade deletes, relational queries) belongs in the entity modules.
 */
export interface Repository<T> {
  /** Load all items in the collection. */
  findAll(): Promise<T[]>;
  /** Replace the entire collection (used for bulk rewrites and pruning). */
  saveAll(items: T[]): Promise<void>;

  /** Find a single item by its primary key. */
  findById(id: string | number): Promise<T | undefined>;
  /** Find items matching all key-value pairs in the filter. */
  findBy(filter: Record<string, unknown>): Promise<T[]>;
  /** Upsert a single item (insert or update by id). */
  save(item: T): Promise<void>;
  /** Upsert multiple items in a single batch (no deletes — unlike saveAll). */
  saveMany(items: T[]): Promise<void>;
  /** Delete a single item by its primary key. Returns true if it existed. */
  deleteById(id: string | number): Promise<boolean>;
  /** Return the maximum numeric id in the collection, or 0 if empty. */
  maxId(): Promise<number>;
}

/**
 * JSON file-based repository implementation.
 * Takes an explicit dataDir — no global state.
 */
export function createJsonRepository<T>(filename: string, dataDir: string): Repository<T> {
  function readItems(): T[] {
    const path = join(dataDir, filename);
    if (!existsSync(path)) return [];
    return JSON.parse(readFileSync(path, "utf-8")) as T[];
  }

  function writeItems(items: T[]): void {
    writeFileSync(
      join(dataDir, filename),
      JSON.stringify(items, null, 2),
    );
  }

  function getId(item: T): string | number {
    return (item as Record<string, unknown>).id as string | number;
  }

  return {
    async findAll(): Promise<T[]> {
      return readItems();
    },

    async saveAll(items: T[]): Promise<void> {
      writeItems(items);
    },

    async findById(id: string | number): Promise<T | undefined> {
      return readItems().find((item) => getId(item) === id);
    },

    async findBy(filter: Record<string, unknown>): Promise<T[]> {
      const items = readItems();
      return items.filter((item) => {
        const record = item as Record<string, unknown>;
        return Object.entries(filter).every(([key, value]) => record[key] === value);
      });
    },

    async save(item: T): Promise<void> {
      const items = readItems();
      const id = getId(item);
      const index = items.findIndex((i) => getId(i) === id);
      if (index === -1) {
        items.push(item);
      } else {
        items[index] = item;
      }
      writeItems(items);
    },

    async saveMany(newItems: T[]): Promise<void> {
      if (newItems.length === 0) return;
      const items = readItems();
      for (const newItem of newItems) {
        const id = getId(newItem);
        const index = items.findIndex((i) => getId(i) === id);
        if (index === -1) {
          items.push(newItem);
        } else {
          items[index] = newItem;
        }
      }
      writeItems(items);
    },

    async deleteById(id: string | number): Promise<boolean> {
      const items = readItems();
      const index = items.findIndex((i) => getId(i) === id);
      if (index === -1) return false;
      items.splice(index, 1);
      writeItems(items);
      return true;
    },

    async maxId(): Promise<number> {
      const items = readItems();
      if (items.length === 0) return 0;
      return Math.max(...items.map((i) => Number(getId(i))));
    },
  };
}
