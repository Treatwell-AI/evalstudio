import pg from "pg";

const { Pool } = pg;
export type { Pool } from "pg";

/**
 * Creates a pg connection pool from a connection string.
 * The pool is shared across all repositories in a single StorageProvider instance.
 */
export function createPool(connectionString: string): InstanceType<typeof Pool> {
  return new Pool({ connectionString });
}
