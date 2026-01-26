import { Command } from "commander";
import {
  createEval,
  deleteEval,
  getConnector,
  getConnectorByName,
  getProject,
  getProjectByName,
  getScenario,
  getScenarioByName,
  getEval,
  getEvalWithRelations,
  listEvals,
  updateEval,
  type Eval,
  type EvalWithRelations,
} from "evalstudio";

function resolveProject(identifier: string) {
  return getProject(identifier) ?? getProjectByName(identifier);
}

function resolveScenario(projectId: string, identifier: string) {
  return getScenario(identifier) ?? getScenarioByName(projectId, identifier);
}

function resolveConnector(projectId: string, identifier: string) {
  return getConnector(identifier) ?? getConnectorByName(projectId, identifier);
}

function getEvalDisplayName(evalItem: Eval | EvalWithRelations): string {
  return evalItem.name || evalItem.id;
}

export const evalCommand = new Command("eval")
  .description("Manage evals")
  .addCommand(
    new Command("create")
      .description("Create a new eval")
      .requiredOption("-n, --name <name>", "Eval name")
      .requiredOption("-p, --project <project>", "Project ID or name")
      .requiredOption("-c, --connector <connector>", "Connector ID or name (required)")
      .requiredOption("--scenario <scenario>", "Scenario ID or name (required)")
      .option("--json", "Output as JSON")
      .action(
        (
          options: {
            name: string;
            project: string;
            connector: string;
            scenario: string;
            json?: boolean;
          }
        ) => {
          try {
            const project = resolveProject(options.project);
            if (!project) {
              console.error(`Error: Project "${options.project}" not found`);
              process.exit(1);
            }

            const connector = resolveConnector(project.id, options.connector);
            if (!connector) {
              console.error(`Error: Connector "${options.connector}" not found`);
              process.exit(1);
            }

            const scenario = resolveScenario(project.id, options.scenario);
            if (!scenario) {
              console.error(`Error: Scenario "${options.scenario}" not found`);
              process.exit(1);
            }

            const evalItem = createEval({
              projectId: project.id,
              name: options.name,
              scenarioIds: [scenario.id],
              connectorId: connector.id,
            });

            if (options.json) {
              console.log(JSON.stringify(evalItem, null, 2));
            } else {
              console.log(`Eval created successfully`);
              console.log(`  ID:          ${evalItem.id}`);
              console.log(`  Name:        ${evalItem.name}`);
              console.log(`  Project:     ${project.name}`);
              console.log(`  Connector:   ${connector.name}`);
              console.log(`  Scenario:    ${scenario.name}`);
              if (scenario.successCriteria) {
                console.log(`  Success:     ${scenario.successCriteria}`);
              }
              if (scenario.failureCriteria) {
                console.log(`  Failure:     ${scenario.failureCriteria}`);
              }
              if (scenario.maxMessages) {
                console.log(`  Max Msgs:    ${scenario.maxMessages}`);
              }
              console.log(`  Created:     ${evalItem.createdAt}`);
            }
          } catch (error) {
            if (error instanceof Error) {
              console.error(`Error: ${error.message}`);
              process.exit(1);
            }
            throw error;
          }
        }
      )
  )
  .addCommand(
    new Command("list")
      .description("List evals")
      .option("-p, --project <project>", "Filter by project ID or name")
      .option("--json", "Output as JSON")
      .action((options: { project?: string; json?: boolean }) => {
        let projectId: string | undefined;

        if (options.project) {
          const project = resolveProject(options.project);
          if (!project) {
            console.error(`Error: Project "${options.project}" not found`);
            process.exit(1);
          }
          projectId = project.id;
        }

        const evals = listEvals(projectId);

        if (options.json) {
          console.log(JSON.stringify(evals, null, 2));
        } else {
          if (evals.length === 0) {
            console.log("No evals found");
            return;
          }

          console.log("Evals:");
          console.log("------");
          for (const evalItem of evals) {
            const project = getProject(evalItem.projectId);
            const firstScenario = evalItem.scenarioIds?.[0] ? getScenario(evalItem.scenarioIds[0]) : undefined;
            const displayName = getEvalDisplayName(evalItem);
            console.log(`  ${displayName} (${evalItem.id})`);
            if (project) {
              console.log(`    Project: ${project.name}`);
            }
            if (evalItem.scenarioIds.length > 1) {
              console.log(`    Scenarios: ${evalItem.scenarioIds.length}`);
            }
          }
        }
      })
  )
  .addCommand(
    new Command("show")
      .description("Show eval details")
      .argument("<id>", "Eval ID")
      .option("--expand", "Include scenario details")
      .option("--json", "Output as JSON")
      .action(
        (
          id: string,
          options: { expand?: boolean; json?: boolean }
        ) => {
          const evalItem = options.expand
            ? getEvalWithRelations(id)
            : getEval(id);

          if (!evalItem) {
            console.error(`Error: Eval "${id}" not found`);
            process.exit(1);
          }

          const project = getProject(evalItem.projectId);
          const displayName = getEvalDisplayName(evalItem);

          if (options.json) {
            console.log(JSON.stringify(evalItem, null, 2));
          } else {
            const firstScenarioId = evalItem.scenarioIds?.[0];
            const firstScenario = firstScenarioId ? getScenario(firstScenarioId) : undefined;
            console.log(`Eval: ${displayName}`);
            console.log(`------`);
            console.log(`  ID:          ${evalItem.id}`);
            console.log(`  Name:        ${evalItem.name}`);
            console.log(`  Project:     ${project?.name ?? evalItem.projectId}`);
            if (firstScenario?.successCriteria) {
              console.log(`  Success:     ${firstScenario.successCriteria}`);
            }
            if (firstScenario?.failureCriteria) {
              console.log(`  Failure:     ${firstScenario.failureCriteria}`);
            }
            if (firstScenario?.maxMessages) {
              console.log(`  Max Msgs:    ${firstScenario.maxMessages}`);
            }

            if (options.expand) {
              const withRelations = evalItem as EvalWithRelations;
              if (withRelations.scenarios?.length) {
                console.log(`  Scenarios:`);
                for (const scenario of withRelations.scenarios) {
                  console.log(`    - ${scenario.name}`);
                  if (scenario.instructions) {
                    console.log(`      ${scenario.instructions}`);
                  }
                }
              }
            } else {
              console.log(`  Scenarios:   ${evalItem.scenarioIds?.length ?? 0}`);
              if (firstScenario) {
                console.log(`    - ${firstScenario.name}`);
              }
            }

            console.log(`  Created:     ${evalItem.createdAt}`);
            console.log(`  Updated:     ${evalItem.updatedAt}`);
          }
        }
      )
  )
  .addCommand(
    new Command("update")
      .description("Update an eval")
      .argument("<id>", "Eval ID")
      .option("-n, --name <name>", "New eval name")
      .option("--scenario <scenario>", "New scenario ID or name")
      .option("--connector <connector>", "New connector ID or name")
      .option("--json", "Output as JSON")
      .action(
        (
          id: string,
          options: {
            name?: string;
            scenario?: string;
            connector?: string;
            json?: boolean;
          }
        ) => {
          const existing = getEval(id);

          if (!existing) {
            console.error(`Error: Eval "${id}" not found`);
            process.exit(1);
          }

          try {
            let scenarioIds: string[] | undefined;
            if (options.scenario) {
              const scenario = resolveScenario(existing.projectId, options.scenario);
              if (!scenario) {
                console.error(`Error: Scenario "${options.scenario}" not found`);
                process.exit(1);
              }
              scenarioIds = [scenario.id];
            }

            let connectorId: string | undefined;
            if (options.connector) {
              const connector = resolveConnector(existing.projectId, options.connector);
              if (!connector) {
                console.error(`Error: Connector "${options.connector}" not found`);
                process.exit(1);
              }
              connectorId = connector.id;
            }

            const updated = updateEval(existing.id, {
              name: options.name,
              scenarioIds,
              connectorId,
            });

            if (!updated) {
              console.error(`Error: Failed to update eval`);
              process.exit(1);
            }

            const project = getProject(updated.projectId);
            const firstScenarioId = updated.scenarioIds?.[0];
            const firstScenario = firstScenarioId ? getScenario(firstScenarioId) : undefined;
            const displayName = getEvalDisplayName(updated);

            if (options.json) {
              console.log(JSON.stringify(updated, null, 2));
            } else {
              console.log(`Eval updated successfully`);
              console.log(`  ID:          ${updated.id}`);
              console.log(`  Name:        ${updated.name}`);
              console.log(`  Project:     ${project?.name ?? updated.projectId}`);
              if (firstScenario?.successCriteria) {
                console.log(`  Success:     ${firstScenario.successCriteria}`);
              }
              if (firstScenario?.failureCriteria) {
                console.log(`  Failure:     ${firstScenario.failureCriteria}`);
              }
              if (firstScenario?.maxMessages) {
                console.log(`  Max Msgs:    ${firstScenario.maxMessages}`);
              }
              console.log(`  Scenarios:   ${updated.scenarioIds?.length ?? 0}`);
              console.log(`  Updated:     ${updated.updatedAt}`);
            }
          } catch (error) {
            if (error instanceof Error) {
              console.error(`Error: ${error.message}`);
              process.exit(1);
            }
            throw error;
          }
        }
      )
  )
  .addCommand(
    new Command("delete")
      .description("Delete an eval")
      .argument("<id>", "Eval ID")
      .option("--json", "Output as JSON")
      .action((id: string, options: { json?: boolean }) => {
        const existing = getEval(id);

        if (!existing) {
          console.error(`Error: Eval "${id}" not found`);
          process.exit(1);
        }

        const displayName = getEvalDisplayName(existing);
        const deleted = deleteEval(existing.id);

        if (!deleted) {
          console.error(`Error: Failed to delete eval`);
          process.exit(1);
        }

        if (options.json) {
          console.log(JSON.stringify({ deleted: true, id: existing.id }));
        } else {
          console.log(`Eval "${displayName}" deleted successfully`);
        }
      })
  );
