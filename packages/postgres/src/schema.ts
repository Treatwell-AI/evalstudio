import type { Pool } from "pg";
import { runMigrations } from "./migrator.js";

/**
 * Initializes the database schema by running all pending migrations.
 * Safe to call on every startup — already-applied migrations are skipped.
 */
export async function initSchema(pool: Pool): Promise<void> {
  await runMigrations(pool);
}

/**
 * Checks if the schema has been initialized (schema_migrations table exists
 * and has at least one applied migration).
 */
export async function schemaExists(pool: Pool): Promise<boolean> {
  const result = await pool.query(
    `SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_name = 'schema_migrations'
    ) AS exists`,
  );
  if (!result.rows[0].exists) return false;

  const count = await pool.query<{ count: string }>(
    "SELECT COUNT(*) AS count FROM schema_migrations",
  );
  return parseInt(count.rows[0].count, 10) > 0;
}
