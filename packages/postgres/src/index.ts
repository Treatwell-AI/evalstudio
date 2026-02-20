import type { StorageProvider } from "@evalstudio/core";
import { createPool } from "./pool.js";
import { createPostgresStorageProvider } from "./postgres-storage.js";
import { initSchema as initSchemaImpl } from "./schema.js";

/**
 * Creates a PostgreSQL-backed StorageProvider.
 *
 * The database schema must already exist — run `evalstudio db init` first.
 * The connection pool is shared across all repositories.
 *
 * @param connectionString - PostgreSQL connection string
 * @returns StorageProvider backed by PostgreSQL
 */
export async function createPostgresStorage(connectionString: string): Promise<StorageProvider> {
  const pool = createPool(connectionString);

  // Verify connection immediately so bad credentials fail at startup
  const client = await pool.connect();
  client.release();

  return createPostgresStorageProvider(pool);
}

/**
 * Explicitly initializes the database schema.
 * Used by the `evalstudio db init` CLI command.
 *
 * @param connectionString - PostgreSQL connection string
 */
export async function initSchema(connectionString: string): Promise<void> {
  const pool = createPool(connectionString);
  try {
    await initSchemaImpl(pool);
  } finally {
    await pool.end();
  }
}
