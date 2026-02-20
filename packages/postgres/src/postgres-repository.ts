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
 * PostgreSQL-backed Repository<T> implementation.
 *
 * Uses the same findAll/saveAll interface as the JSON file repository.
 * Entity data is stored as JSONB in a `data` column. Reference columns
 * (project_id, eval_id, etc.) are duplicated from the data for relational
 * integrity and indexing.
 */
export function createPostgresRepository<T>(
  pool: Pool,
  entity: string,
  projectId: string,
): Repository<T> {
  const table = getTableName(entity);

  return {
    async findAll(): Promise<T[]> {
      const { rows } = await pool.query(
        `SELECT data FROM ${table} WHERE project_id = $1`,
        [projectId],
      );
      return rows.map((r: { data: T }) => r.data);
    },

    async saveAll(items: T[]): Promise<void> {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(`DELETE FROM ${table} WHERE project_id = $1`, [projectId]);

        for (const item of items) {
          const data = item as Record<string, unknown>;
          const id = data.id as string;

          // Build reference columns based on entity type
          const refColumns = extractReferenceColumns(table, data);

          const columns = ["id", "project_id", "data", ...Object.keys(refColumns)];
          const values = [id, projectId, JSON.stringify(item), ...Object.values(refColumns)];
          const placeholders = values.map((_, i) => `$${i + 1}`).join(", ");

          await client.query(
            `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`,
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

/**
 * Extracts reference columns from entity data based on the table type.
 * These are duplicated from the JSONB data for relational integrity.
 */
function extractReferenceColumns(
  table: string,
  data: Record<string, unknown>,
): Record<string, unknown> {
  switch (table) {
    case "evals":
      return {
        connector_id: data.connectorId ?? null,
      };
    case "executions":
      return {
        eval_id: data.evalId ?? null,
      };
    case "runs":
      return {
        eval_id: data.evalId ?? null,
        scenario_id: data.scenarioId ?? null,
        persona_id: data.personaId ?? null,
        connector_id: data.connectorId ?? null,
        execution_id: data.executionId ?? null,
        status: data.status ?? "queued",
      };
    default:
      return {};
  }
}
