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

/**
 * PostgreSQL-backed Repository<T> implementation.
 *
 * Relational fields (FKs, status) live exclusively in SQL columns, never in
 * JSONB. On write, these fields are extracted into columns and stripped from
 * the data blob. On read, column values are merged back into the returned
 * objects. This ensures ON DELETE CASCADE/SET NULL works correctly without
 * JSONB getting out of sync.
 *
 * Uses UPSERT (INSERT ON CONFLICT UPDATE) + selective DELETE instead of
 * DELETE-all + INSERT-all, which is safe under concurrent transactions.
 */
export function createPostgresRepository<T>(
  pool: Pool,
  entity: string,
  projectId: string,
): Repository<T> {
  const table = getTableName(entity);
  const mappings = COLUMN_MAPPINGS[table] ?? [];
  const conflictCols = CONFLICT_COLUMNS[table] ?? ["id"];

  return {
    async findAll(): Promise<T[]> {
      if (mappings.length === 0) {
        const { rows } = await pool.query(
          `SELECT data FROM ${table} WHERE project_id = $1`,
          [projectId],
        );
        return rows.map((r: { data: T }) => r.data);
      }

      // Read columns alongside JSONB and merge them back as source of truth
      const columnList = mappings.map((m) => m.column).join(", ");
      const { rows } = await pool.query(
        `SELECT data, ${columnList} FROM ${table} WHERE project_id = $1`,
        [projectId],
      );

      return rows.map((r: Record<string, unknown>) => {
        const item = r.data as Record<string, unknown>;
        for (const mapping of mappings) {
          const colValue = r[mapping.column];
          if (colValue === null || colValue === undefined) {
            delete item[mapping.jsonKey];
          } else {
            item[mapping.jsonKey] = colValue;
          }
        }
        return item as T;
      });
    },

    async saveAll(items: T[]): Promise<void> {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        // Collect IDs of items being saved
        const itemIds = items.map((item) => (item as Record<string, unknown>).id as string);

        // Delete rows that are no longer in the items list
        if (itemIds.length === 0) {
          await client.query(`DELETE FROM ${table} WHERE project_id = $1`, [projectId]);
        } else {
          await client.query(
            `DELETE FROM ${table} WHERE project_id = $1 AND id != ALL($2::${table === "executions" ? "int" : "uuid"}[])`,
            [projectId, itemIds],
          );
        }

        // Upsert each item
        for (const item of items) {
          const data = item as Record<string, unknown>;
          const id = data.id as string;

          // Extract column values and build clean JSONB without relational fields
          const refColumns: Record<string, unknown> = {};
          const cleanData = { ...data };

          for (const mapping of mappings) {
            refColumns[mapping.column] = data[mapping.jsonKey] ?? mapping.defaultValue ?? null;
            delete cleanData[mapping.jsonKey];
          }

          const columns = ["id", "project_id", "data", ...Object.keys(refColumns)];
          const values = [id, projectId, JSON.stringify(cleanData), ...Object.values(refColumns)];
          const placeholders = values.map((_, i) => `$${i + 1}`).join(", ");

          // Build SET clause for ON CONFLICT UPDATE (update data + ref columns)
          const updateCols = ["data", ...Object.keys(refColumns)];
          const setClause = updateCols.map((col) => `${col} = EXCLUDED.${col}`).join(", ");
          const conflictTarget = conflictCols.join(", ");

          await client.query(
            `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})
             ON CONFLICT (${conflictTarget}) DO UPDATE SET ${setClause}`,
            values,
          );
        }

        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    },
  };
}
