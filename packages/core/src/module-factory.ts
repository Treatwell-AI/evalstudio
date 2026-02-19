import { createJsonRepository } from "./repository.js";
import { createPersonaModule, type PersonaModule, type Persona } from "./persona.js";
import { createScenarioModule, type ScenarioModule, type Scenario } from "./scenario.js";
import { createConnectorModule, type ConnectorModule, type Connector } from "./connector.js";
import { createExecutionModule, type ExecutionModule, type Execution } from "./execution.js";
import { createEvalModule, type EvalModule, type Eval } from "./eval.js";
import { createRunModule, type RunModule, type Run } from "./run.js";
import type { ProjectContext } from "./project-resolver.js";

/**
 * All entity modules for a project, fully wired with dependencies.
 */
export interface ProjectModules {
  personas: PersonaModule;
  scenarios: ScenarioModule;
  connectors: ConnectorModule;
  executions: ExecutionModule;
  evals: EvalModule;
  runs: RunModule;
}

/**
 * Creates all entity modules for a project, wired together with proper dependencies.
 *
 * Uses createJsonRepository directly (filesystem storage).
 * In Phase 2, callers will use StorageProvider.createRepository() instead.
 */
export function createProjectModules(ctx: ProjectContext): ProjectModules {
  const personaRepo = createJsonRepository<Persona>("personas.json", ctx.dataDir);
  const scenarioRepo = createJsonRepository<Scenario>("scenarios.json", ctx.dataDir);
  const connectorRepo = createJsonRepository<Connector>("connectors.json", ctx.dataDir);
  const executionRepo = createJsonRepository<Execution>("executions.json", ctx.dataDir);
  const evalRepo = createJsonRepository<Eval>("evals.json", ctx.dataDir);
  const runRepo = createJsonRepository<Run>("runs.json", ctx.dataDir);

  const personaMod = createPersonaModule(personaRepo);
  const scenarioMod = createScenarioModule(scenarioRepo);
  const connectorMod = createConnectorModule(connectorRepo);
  const executionMod = createExecutionModule(executionRepo);

  // Eval gets runRepo for cascade deletes (avoids circular dep with RunModule)
  const evalMod = createEvalModule(evalRepo, {
    scenarios: scenarioMod,
    connectors: connectorMod,
    runRepo,
  });

  // Run gets all modules for FK validation
  const runMod = createRunModule(runRepo, {
    evals: evalMod,
    scenarios: scenarioMod,
    personas: personaMod,
    connectors: connectorMod,
    executions: executionMod,
  });

  return {
    personas: personaMod,
    scenarios: scenarioMod,
    connectors: connectorMod,
    executions: executionMod,
    evals: evalMod,
    runs: runMod,
  };
}
