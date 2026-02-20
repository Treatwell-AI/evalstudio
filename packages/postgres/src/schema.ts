import type { Pool } from "pg";

/**
 * SQL schema for EvalStudio PostgreSQL storage.
 *
 * Design: reference columns (project_id, eval_id, etc.) are real columns
 * with REFERENCES constraints for relational integrity. The rest of the
 * entity payload lives in a JSONB `data` column to avoid mapping every
 * field upfront.
 */
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  llm_settings JSONB,
  max_concurrency INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS personas (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  data JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_personas_project ON personas(project_id);

CREATE TABLE IF NOT EXISTS scenarios (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  data JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_scenarios_project ON scenarios(project_id);

CREATE TABLE IF NOT EXISTS connectors (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  data JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_connectors_project ON connectors(project_id);

CREATE TABLE IF NOT EXISTS evals (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  connector_id UUID NOT NULL REFERENCES connectors(id),
  data JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_evals_project ON evals(project_id);
CREATE INDEX IF NOT EXISTS idx_evals_connector ON evals(connector_id);

CREATE TABLE IF NOT EXISTS executions (
  id INTEGER NOT NULL,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  eval_id UUID NOT NULL REFERENCES evals(id),
  data JSONB NOT NULL,
  PRIMARY KEY (project_id, id)
);
CREATE INDEX IF NOT EXISTS idx_executions_project ON executions(project_id);
CREATE INDEX IF NOT EXISTS idx_executions_eval ON executions(eval_id);

CREATE TABLE IF NOT EXISTS runs (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  eval_id UUID REFERENCES evals(id),
  scenario_id UUID NOT NULL REFERENCES scenarios(id),
  persona_id UUID REFERENCES personas(id),
  connector_id UUID REFERENCES connectors(id),
  execution_id INTEGER,
  status TEXT NOT NULL,
  data JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_runs_project ON runs(project_id);
CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(project_id, status);
CREATE INDEX IF NOT EXISTS idx_runs_eval ON runs(project_id, eval_id);
CREATE INDEX IF NOT EXISTS idx_runs_scenario ON runs(project_id, scenario_id);
CREATE INDEX IF NOT EXISTS idx_runs_execution ON runs(project_id, execution_id);
`;

/**
 * Initializes the database schema.
 * Uses IF NOT EXISTS so it's safe to call on every startup.
 */
export async function initSchema(pool: Pool): Promise<void> {
  await pool.query(SCHEMA_SQL);
}

/**
 * Checks if the schema has been initialized (projects table exists).
 */
export async function schemaExists(pool: Pool): Promise<boolean> {
  const result = await pool.query(
    `SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_name = 'projects'
    ) AS exists`,
  );
  return result.rows[0].exists;
}
