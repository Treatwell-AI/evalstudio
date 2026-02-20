/**
 * Migration registry for EvalStudio PostgreSQL storage.
 *
 * Each migration is a versioned SQL string that runs in a transaction.
 * Migrations are forward-only and immutable once shipped — never edit
 * an existing migration. To make changes, add a new one.
 *
 * Naming convention: NNN_descriptive_name (e.g., 001_initial)
 * The `version` integer is what the system uses; the `name` is for humans.
 */

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

export const ALL_MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: "001_initial",
    sql: `
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
    `,
  },
];
