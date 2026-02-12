import { Command } from "commander";
import {
  createRuns,
  deleteRun,
  getConnector,
  getEval,
  getPersona,
  getProject,
  getProjectByName,
  getRun,
  getScenario,
  listRuns,
  RunProcessor,
  type Run,
} from "@evalstudio/core";

function resolveProject(identifier: string) {
  return getProject(identifier) ?? getProjectByName(identifier);
}

function formatRunStatus(run: Run): string {
  const statusColors: Record<string, string> = {
    queued: "\x1b[33m",    // yellow
    running: "\x1b[36m",   // cyan
    completed: "\x1b[32m", // green
    failed: "\x1b[31m",    // red
  };
  const reset = "\x1b[0m";
  const color = statusColors[run.status] ?? "";
  return `${color}${run.status}${reset}`;
}

export const runCommand = new Command("run")
  .description("Manage and process evaluation runs")
  .addCommand(
    new Command("create")
      .description("Create a new run for an eval")
      .requiredOption("-e, --eval <eval>", "Eval ID")
      .option("--json", "Output as JSON")
      .action(
        (options: {
          eval: string;
          json?: boolean;
        }) => {
          try {
            const evalItem = getEval(options.eval);
            if (!evalItem) {
              console.error(`Error: Eval "${options.eval}" not found`);
              process.exit(1);
            }

            const runs = createRuns({ evalId: evalItem.id });

            // Get connector info from eval
            const connector = getConnector(evalItem.connectorId);

            if (options.json) {
              console.log(JSON.stringify(runs, null, 2));
            } else {
              console.log(`${runs.length} run(s) created successfully`);
              console.log("");
              for (const run of runs) {
                const persona = run.personaId ? getPersona(run.personaId) : null;
                console.log(`  ID:        ${run.id}`);
                console.log(`  Eval:      ${run.evalId}`);
                if (persona) {
                  console.log(`  Persona:   ${persona.name}`);
                }
                console.log(`  Connector: ${connector?.name ?? evalItem.connectorId}`);
                console.log(`  Status:    ${formatRunStatus(run)}`);
                console.log(`  Created:   ${run.createdAt}`);
                if (runs.length > 1) console.log("");
              }
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
      .description("List runs")
      .option("-e, --eval <eval>", "Filter by eval ID")
      .option("-p, --project <project>", "Filter by project ID or name")
      .option("-s, --status <status>", "Filter by status (queued, running, completed, failed)")
      .option("-l, --limit <number>", "Maximum number of runs to show")
      .option("--json", "Output as JSON")
      .action(
        (options: {
          eval?: string;
          project?: string;
          status?: string;
          limit?: string;
          json?: boolean;
        }) => {
          let projectId: string | undefined;

          if (options.project) {
            const project = resolveProject(options.project);
            if (!project) {
              console.error(`Error: Project "${options.project}" not found`);
              process.exit(1);
            }
            projectId = project.id;
          }

          const runs = listRuns({
            evalId: options.eval,
            projectId,
            status: options.status as Run["status"] | undefined,
            limit: options.limit ? parseInt(options.limit, 10) : undefined,
          });

          if (options.json) {
            console.log(JSON.stringify(runs, null, 2));
          } else {
            if (runs.length === 0) {
              console.log("No runs found");
              return;
            }

            console.log("Runs:");
            console.log("-----");
            for (const run of runs) {
              console.log(`  ${run.id}`);
              console.log(`    Status:  ${formatRunStatus(run)}`);
              console.log(`    Eval:    ${run.evalId ?? "Playground"}`);
              // Show persona if present
              if (run.personaId) {
                const persona = getPersona(run.personaId);
                console.log(`    Persona: ${persona?.name ?? run.personaId}`);
              }
              // Get connector info from eval or directly from run (playground)
              if (run.evalId) {
                const evalItem = getEval(run.evalId);
                if (evalItem) {
                  const connector = getConnector(evalItem.connectorId);
                  console.log(`    Connector: ${connector?.name ?? evalItem.connectorId}`);
                }
              } else if (run.connectorId) {
                const connector = getConnector(run.connectorId);
                console.log(`    Connector: ${connector?.name ?? run.connectorId}`);
              }
              if (run.error) {
                console.log(`    Error:   ${run.error}`);
              }
              console.log(`    Created: ${run.createdAt}`);
            }
          }
        }
      )
  )
  .addCommand(
    new Command("show")
      .description("Show run details")
      .argument("<id>", "Run ID")
      .option("--json", "Output as JSON")
      .action((id: string, options: { json?: boolean }) => {
        const run = getRun(id);

        if (!run) {
          console.error(`Error: Run "${id}" not found`);
          process.exit(1);
        }

        if (options.json) {
          console.log(JSON.stringify(run, null, 2));
        } else {
          console.log(`Run: ${run.id}`);
          console.log("-----");
          console.log(`  Status:    ${formatRunStatus(run)}`);
          console.log(`  Eval:      ${run.evalId ?? "Playground"}`);
          console.log(`  Project:   ${run.projectId}`);
          // Show scenario and persona
          const scenario = getScenario(run.scenarioId);
          console.log(`  Scenario:  ${scenario?.name ?? run.scenarioId}`);
          if (run.personaId) {
            const persona = getPersona(run.personaId);
            console.log(`  Persona:   ${persona?.name ?? run.personaId}`);
          }
          // Get connector info from eval or directly from run (playground)
          if (run.evalId) {
            const evalItem = getEval(run.evalId);
            if (evalItem) {
              const connector = getConnector(evalItem.connectorId);
              console.log(`  Connector: ${connector?.name ?? evalItem.connectorId}`);
            }
          } else if (run.connectorId) {
            const connector = getConnector(run.connectorId);
            console.log(`  Connector: ${connector?.name ?? run.connectorId}`);
          }
          if (run.startedAt) {
            console.log(`  Started:   ${run.startedAt}`);
          }
          if (run.completedAt) {
            console.log(`  Completed: ${run.completedAt}`);
          }
          if (run.error) {
            console.log(`  Error:     ${run.error}`);
          }
          if (run.messages.length > 0) {
            console.log(`  Messages:  ${run.messages.length}`);
          }
          if (run.result) {
            console.log(`  Result:    ${run.result.success ? "passed" : "failed"}`);
            if (run.result.score !== undefined) {
              console.log(`  Score:     ${run.result.score}`);
            }
            if (run.result.reason) {
              console.log(`  Reason:    ${run.result.reason}`);
            }
          }
          console.log(`  Created:   ${run.createdAt}`);
          console.log(`  Updated:   ${run.updatedAt}`);
        }
      })
  )
  .addCommand(
    new Command("delete")
      .description("Delete a run")
      .argument("<id>", "Run ID")
      .option("--json", "Output as JSON")
      .action((id: string, options: { json?: boolean }) => {
        const run = getRun(id);

        if (!run) {
          console.error(`Error: Run "${id}" not found`);
          process.exit(1);
        }

        const deleted = deleteRun(id);

        if (!deleted) {
          console.error(`Error: Failed to delete run`);
          process.exit(1);
        }

        if (options.json) {
          console.log(JSON.stringify({ deleted: true, id }));
        } else {
          console.log(`Run "${id}" deleted successfully`);
        }
      })
  )
  .addCommand(
    new Command("process")
      .description("Process queued runs")
      .option("-p, --project <project>", "Only process runs for this project")
      .option("-w, --watch", "Watch mode - continuously process runs")
      .option("-c, --concurrency <number>", "Maximum concurrent runs (default: 3)")
      .option("--poll <ms>", "Poll interval in milliseconds (default: 2000)")
      .action(
        async (options: {
          project?: string;
          watch?: boolean;
          concurrency?: string;
          poll?: string;
        }) => {
          let projectId: string | undefined;

          if (options.project) {
            const project = resolveProject(options.project);
            if (!project) {
              console.error(`Error: Project "${options.project}" not found`);
              process.exit(1);
            }
            projectId = project.id;
          }

          const maxConcurrent = options.concurrency
            ? parseInt(options.concurrency, 10)
            : 3;
          const pollIntervalMs = options.poll
            ? parseInt(options.poll, 10)
            : 2000;

          const processor = new RunProcessor({
            pollIntervalMs,
            maxConcurrent,
            projectId,
            onRunStart: (run) => {
              console.log(`\x1b[36m▶\x1b[0m Starting run ${run.id}`);
            },
            onRunComplete: (run, result) => {
              console.log(
                `\x1b[32m✓\x1b[0m Run ${run.id} completed (${result.latencyMs}ms)`
              );
            },
            onRunError: (run, error) => {
              console.error(
                `\x1b[31m✗\x1b[0m Run ${run.id} failed: ${error.message}`
              );
            },
          });

          if (options.watch) {
            // Watch mode: run continuously
            console.log("Starting run processor in watch mode...");
            console.log(`  Concurrency: ${maxConcurrent}`);
            console.log(`  Poll interval: ${pollIntervalMs}ms`);
            if (projectId) {
              const project = getProject(projectId);
              console.log(`  Project: ${project?.name ?? projectId}`);
            }
            console.log("\nPress Ctrl+C to stop\n");

            processor.start();

            // Handle shutdown
            const shutdown = async () => {
              console.log("\nStopping processor...");
              await processor.stop();
              console.log("Processor stopped");
              process.exit(0);
            };

            process.on("SIGINT", shutdown);
            process.on("SIGTERM", shutdown);

            // Keep the process alive
            await new Promise(() => {});
          } else {
            // One-shot mode: process all queued runs and exit
            console.log("Processing queued runs...\n");

            let totalProcessed = 0;
            let hasMore = true;

            while (hasMore) {
              const started = await processor.processOnce();
              totalProcessed += started;

              // Check if there are more queued runs
              const queued = listRuns({
                status: "queued",
                projectId,
                limit: 1,
              });
              hasMore = queued.length > 0;
            }

            if (totalProcessed === 0) {
              console.log("No queued runs found");
            } else {
              console.log(`\nProcessed ${totalProcessed} run(s)`);
            }
          }
        }
      )
  );
