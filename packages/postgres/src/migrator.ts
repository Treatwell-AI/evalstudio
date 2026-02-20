import type { Pool } from "pg";
import { ALL_MIGRATIONS, type Migration } from "./migrations.js";

const SCHEMA_MIGRATIONS_DDL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version    INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`;

export interface MigrationStatus {
  applied: Array<{ version: number; name: string; appliedAt: Date }>;
  pending: Array<{ version: number; name: string }>;
}

/**
 * Runs all pending migrations in order.
 * Each migration executes in its own transaction.
 * Safe to call on every startup — already-applied migrations are skipped.
 */
export async function runMigrations(pool: Pool): Promise<void> {
  await pool.query(SCHEMA_MIGRATIONS_DDL);

  const applied = await getAppliedVersions(pool);

  validateMigrationOrder();

  const pending = ALL_MIGRATIONS.filter((m) => !applied.has(m.version));

  for (const migration of pending) {
    await applyMigration(pool, migration);
  }
}

/**
 * Returns the current migration status: which are applied and which are pending.
 */
export async function getMigrationStatus(pool: Pool): Promise<MigrationStatus> {
  // Check if schema_migrations table exists
  const tableExists = await pool.query(
    `SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_name = 'schema_migrations'
    ) AS exists`,
  );

  if (!tableExists.rows[0].exists) {
    return {
      applied: [],
      pending: ALL_MIGRATIONS.map((m) => ({ version: m.version, name: m.name })),
    };
  }

  const { rows } = await pool.query<{ version: number; name: string; applied_at: Date }>(
    "SELECT version, name, applied_at FROM schema_migrations ORDER BY version",
  );

  const appliedVersions = new Set(rows.map((r) => r.version));

  return {
    applied: rows.map((r) => ({ version: r.version, name: r.name, appliedAt: r.applied_at })),
    pending: ALL_MIGRATIONS
      .filter((m) => !appliedVersions.has(m.version))
      .map((m) => ({ version: m.version, name: m.name })),
  };
}

async function getAppliedVersions(pool: Pool): Promise<Set<number>> {
  const { rows } = await pool.query<{ version: number }>(
    "SELECT version FROM schema_migrations ORDER BY version",
  );
  return new Set(rows.map((r) => r.version));
}

function validateMigrationOrder(): void {
  for (let i = 1; i < ALL_MIGRATIONS.length; i++) {
    if (ALL_MIGRATIONS[i].version <= ALL_MIGRATIONS[i - 1].version) {
      throw new Error(
        `Migration ordering error: ${ALL_MIGRATIONS[i].name} ` +
        `(version ${ALL_MIGRATIONS[i].version}) must be greater than ` +
        `${ALL_MIGRATIONS[i - 1].name} (version ${ALL_MIGRATIONS[i - 1].version})`,
      );
    }
  }
}

async function applyMigration(pool: Pool, migration: Migration): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(migration.sql);
    await client.query(
      "INSERT INTO schema_migrations (version, name) VALUES ($1, $2)",
      [migration.version, migration.name],
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw new Error(
      `Migration ${migration.name} failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  } finally {
    client.release();
  }
}
