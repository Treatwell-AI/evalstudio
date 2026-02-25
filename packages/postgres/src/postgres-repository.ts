import type { Pool } from "pg";
import type { Repository } from "@evalstudio/core";

/**
 * Maps entity names to their table names.
 * Entity names come from the module factory (e.g., "personas", "scenarios").
 */
const TABLE_MAP: Record<string, string> = {
  personas: "personas",
  scenarios: "scenarios",
  connectors: "connectors",
  evals: "evals",
  runs: "runs",
  executions: "executions",
};

function getTableName(entity: string): string {
  const table = TABLE_MAP[entity];
  if (!table) {
    throw new Error(`Unknown entity type: ${entity}`);
  }
  return table;
}

/**
 * Defines the mapping between SQL columns and JSONB field names for each table.
 * These fields are stored ONLY in columns — they are stripped from JSONB on write
 * and merged back on read. Columns are the single source of truth for relations.
 */
interface ColumnMapping {
  column: string;
  jsonKey: string;
  defaultValue?: unknown;
}

const COLUMN_MAPPINGS: Record<string, ColumnMapping[]> = {
  evals: [
    { column: "connector_id", jsonKey: "connectorId" },
  ],
  executions: [
    { column: "eval_id", jsonKey: "evalId" },
  ],
  runs: [
    { column: "eval_id", jsonKey: "evalId" },
    { column: "scenario_id", jsonKey: "scenarioId" },
    { column: "persona_id", jsonKey: "personaId" },
    { column: "connector_id", jsonKey: "connectorId" },
    { column: "execution_id", jsonKey: "executionId" },
    { column: "status", jsonKey: "status", defaultValue: "queued" },
  ],
};

/**
 * Unique constraint columns per table, used for ON CONFLICT in upserts.
 * Most tables use (id), executions uses (project_id, id) composite PK.
 */
const CONFLICT_COLUMNS: Record<string, string[]> = {
  executions: ["project_id", "id"],
};

// ── Shared helpers ────────────────────────────────────────────────────

/** Merge SQL column values back into the JSONB object. */
function mergeColumns(row: Record<string, unknown>, mappings: ColumnMapping[]): Record<string, unknown> {
  const item = row.data as Record<string, unknown>;
  for (const mapping of mappings) {
    const colValue = row[mapping.column];
    if (colValue === null || colValue === undefined) {
      delete item[mapping.jsonKey];
    } else {
      item[mapping.jsonKey] = colValue;
    }
  }
  return item;
}

/** Build the SELECT column list (data + any mapped columns). */
function selectColumns(mappings: ColumnMapping[]): string {
  if (mappings.length === 0) return "data";
  return `data, ${mappings.map((m) => m.column).join(", ")}`;
}

/** Build upsert query parts from an item. */
function buildUpsert(
  item: Record<string, unknown>,
  table: string,
  projectId: string,
  mappings: ColumnMapping[],
  conflictCols: string[],
): { sql: string; values: unknown[] } {
  const id = item.id;
  const refColumns: Record<string, unknown> = {};
  const cleanData = { ...item };

  for (const mapping of mappings) {
    refColumns[mapping.column] = item[mapping.jsonKey] ?? mapping.defaultValue ?? null;
    delete cleanData[mapping.jsonKey];
  }

  const columns = ["id", "project_id", "data", ...Object.keys(refColumns)];
  const values = [id, projectId, JSON.stringify(cleanData), ...Object.values(refColumns)];
  const placeholders = values.map((_, i) => `$${i + 1}`).join(", ");

  const updateCols = ["data", ...Object.keys(refColumns)];
  const setClause = updateCols.map((col) => `${col} = EXCLUDED.${col}`).join(", ");
  const conflictTarget = conflictCols.join(", ");

  const sql = `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})
     ON CONFLICT (${conflictTarget}) DO UPDATE SET ${setClause}`;
  return { sql, values };
}

/**
 * PostgreSQL-backed Repository<T> implementation.
 *
 * Relational fields (FKs, status) live exclusively in SQL columns, never in
 * JSONB. On write, these fields are extracted into columns and stripped from
 * the data blob. On read, column values are merged back into the returned
 * objects. This ensures ON DELETE CASCADE/SET NULL works correctly without
 * JSONB getting out of sync.
 */
export function createPostgresRepository<T>(
  pool: Pool,
  entity: string,
  projectId: string,
): Repository<T> {
  const table = getTableName(entity);
  const mappings = COLUMN_MAPPINGS[table] ?? [];
  const conflictCols = CONFLICT_COLUMNS[table] ?? ["id"];
  const cols = selectColumns(mappings);

  return {
    // ── Collection-level operations ─────────────────────────────────

    async findAll(): Promise<T[]> {
      const { rows } = await pool.query(
        `SELECT ${cols} FROM ${table} WHERE project_id = $1`,
        [projectId],
      );
      if (mappings.length === 0) {
        return rows.map((r: { data: T }) => r.data);
      }
      return rows.map((r: Record<string, unknown>) => mergeColumns(r, mappings) as T);
    },

    async saveAll(items: T[]): Promise<void> {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        const itemIds = items.map((item) => (item as Record<string, unknown>).id as string);

        if (itemIds.length === 0) {
          await client.query(`DELETE FROM ${table} WHERE project_id = $1`, [projectId]);
        } else {
          await client.query(
            `DELETE FROM ${table} WHERE project_id = $1 AND id != ALL($2::${table === "executions" ? "int" : "uuid"}[])`,
            [projectId, itemIds],
          );
        }

        for (const item of items) {
          const { sql, values } = buildUpsert(item as Record<string, unknown>, table, projectId, mappings, conflictCols);
          await client.query(sql, values);
        }

        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    },

    // ── Targeted read operations ────────────────────────────────────

    async findById(id: string | number): Promise<T | undefined> {
      const { rows } = await pool.query(
        `SELECT ${cols} FROM ${table} WHERE project_id = $1 AND id = $2`,
        [projectId, id],
      );
      if (rows.length === 0) return undefined;
      if (mappings.length === 0) return (rows[0] as { data: T }).data;
      return mergeColumns(rows[0] as Record<string, unknown>, mappings) as T;
    },

    async findBy(filter: Record<string, unknown>): Promise<T[]> {
      const conditions: string[] = [`project_id = $1`];
      const values: unknown[] = [projectId];
      let paramIndex = 2;

      for (const [key, value] of Object.entries(filter)) {
        const mapping = mappings.find((m) => m.jsonKey === key);
        if (mapping) {
          // Column-mapped field — query the SQL column directly (uses indexes)
          conditions.push(`${mapping.column} = $${paramIndex}`);
        } else {
          // Fall back to JSONB text extraction
          conditions.push(`data->>'${key.replace(/[^a-zA-Z0-9_]/g, "")}' = $${paramIndex}`);
        }
        values.push(value);
        paramIndex++;
      }

      const { rows } = await pool.query(
        `SELECT ${cols} FROM ${table} WHERE ${conditions.join(" AND ")}`,
        values,
      );
      if (mappings.length === 0) {
        return rows.map((r: { data: T }) => r.data);
      }
      return rows.map((r: Record<string, unknown>) => mergeColumns(r, mappings) as T);
    },

    // ── Targeted write operations ───────────────────────────────────

    async save(item: T): Promise<void> {
      const { sql, values } = buildUpsert(item as Record<string, unknown>, table, projectId, mappings, conflictCols);
      await pool.query(sql, values);
    },

    async saveMany(items: T[]): Promise<void> {
      if (items.length === 0) return;
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        for (const item of items) {
          const { sql, values } = buildUpsert(item as Record<string, unknown>, table, projectId, mappings, conflictCols);
          await client.query(sql, values);
        }
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    },

    async deleteById(id: string | number): Promise<boolean> {
      const result = await pool.query(
        `DELETE FROM ${table} WHERE project_id = $1 AND id = $2`,
        [projectId, id],
      );
      return (result.rowCount ?? 0) > 0;
    },

    async maxId(): Promise<number> {
      const { rows } = await pool.query(
        `SELECT COALESCE(MAX(id), 0) AS max_id FROM ${table} WHERE project_id = $1`,
        [projectId],
      );
      return Number(rows[0].max_id);
    },
  };
}
