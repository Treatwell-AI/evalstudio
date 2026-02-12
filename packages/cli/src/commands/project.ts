import { Command } from "commander";
import {
  createProject,
  deleteProject,
  getLLMProvider,
  getProject,
  getProjectByName,
  listLLMProviders,
  listProjects,
  updateProject,
  type ProjectLLMSettings,
} from "@evalstudio/core";

export const projectCommand = new Command("project")
  .description("Manage projects")
  .addCommand(
    new Command("create")
      .description("Create a new project")
      .argument("<name>", "Project name")
      .option("-d, --description <description>", "Project description")
      .option("--json", "Output as JSON")
      .action(
        (
          name: string,
          options: { description?: string; json?: boolean }
        ) => {
          try {
            const project = createProject({
              name,
              description: options.description,
            });

            if (options.json) {
              console.log(JSON.stringify(project, null, 2));
            } else {
              console.log(`Project created successfully`);
              console.log(`  ID:          ${project.id}`);
              console.log(`  Name:        ${project.name}`);
              if (project.description) {
                console.log(`  Description: ${project.description}`);
              }
              console.log(`  Created:     ${project.createdAt}`);
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
      .description("List all projects")
      .option("--json", "Output as JSON")
      .action((options: { json?: boolean }) => {
        const projects = listProjects();

        if (options.json) {
          console.log(JSON.stringify(projects, null, 2));
        } else {
          if (projects.length === 0) {
            console.log("No projects found");
            return;
          }

          console.log("Projects:");
          console.log("---------");
          for (const project of projects) {
            console.log(`  ${project.name} (${project.id})`);
            if (project.description) {
              console.log(`    ${project.description}`);
            }
          }
        }
      })
  )
  .addCommand(
    new Command("show")
      .description("Show project details")
      .argument("<identifier>", "Project ID or name")
      .option("--json", "Output as JSON")
      .action((identifier: string, options: { json?: boolean }) => {
        const project = getProject(identifier) ?? getProjectByName(identifier);

        if (!project) {
          console.error(`Error: Project "${identifier}" not found`);
          process.exit(1);
        }

        if (options.json) {
          console.log(JSON.stringify(project, null, 2));
        } else {
          console.log(`Project: ${project.name}`);
          console.log(`---------`);
          console.log(`  ID:          ${project.id}`);
          console.log(`  Name:        ${project.name}`);
          if (project.description) {
            console.log(`  Description: ${project.description}`);
          }
          console.log(`  Created:     ${project.createdAt}`);
          console.log(`  Updated:     ${project.updatedAt}`);
        }
      })
  )
  .addCommand(
    new Command("update")
      .description("Update a project")
      .argument("<identifier>", "Project ID or name")
      .option("-n, --name <name>", "New project name")
      .option("-d, --description <description>", "New project description")
      .option("--json", "Output as JSON")
      .action(
        (
          identifier: string,
          options: { name?: string; description?: string; json?: boolean }
        ) => {
          const existing =
            getProject(identifier) ?? getProjectByName(identifier);

          if (!existing) {
            console.error(`Error: Project "${identifier}" not found`);
            process.exit(1);
          }

          try {
            const updated = updateProject(existing.id, {
              name: options.name,
              description: options.description,
            });

            if (!updated) {
              console.error(`Error: Failed to update project`);
              process.exit(1);
            }

            if (options.json) {
              console.log(JSON.stringify(updated, null, 2));
            } else {
              console.log(`Project updated successfully`);
              console.log(`  ID:          ${updated.id}`);
              console.log(`  Name:        ${updated.name}`);
              if (updated.description) {
                console.log(`  Description: ${updated.description}`);
              }
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
      .description("Delete a project")
      .argument("<identifier>", "Project ID or name")
      .option("--json", "Output as JSON")
      .action((identifier: string, options: { json?: boolean }) => {
        const existing =
          getProject(identifier) ?? getProjectByName(identifier);

        if (!existing) {
          console.error(`Error: Project "${identifier}" not found`);
          process.exit(1);
        }

        const deleted = deleteProject(existing.id);

        if (!deleted) {
          console.error(`Error: Failed to delete project`);
          process.exit(1);
        }

        if (options.json) {
          console.log(JSON.stringify({ deleted: true, id: existing.id }));
        } else {
          console.log(`Project "${existing.name}" deleted successfully`);
        }
      })
  )
  .addCommand(
    new Command("llm-settings")
      .description("Manage project LLM settings")
      .addCommand(
        new Command("show")
          .description("Show current LLM settings")
          .argument("<identifier>", "Project ID or name")
          .option("--json", "Output as JSON")
          .action((identifier: string, options: { json?: boolean }) => {
            const project =
              getProject(identifier) ?? getProjectByName(identifier);

            if (!project) {
              console.error(`Error: Project "${identifier}" not found`);
              process.exit(1);
            }

            if (options.json) {
              console.log(JSON.stringify(project.llmSettings ?? {}, null, 2));
            } else {
              console.log(`Project LLM Settings: ${project.name}`);
              console.log(`─────────────────────────────────`);

              const settings = project.llmSettings;
              if (!settings || (!settings.evaluation && !settings.persona)) {
                console.log("  No LLM settings configured");
                console.log("");
                console.log(
                  "  Use 'evalstudio project llm-settings set' to configure."
                );
                return;
              }

              console.log("");
              console.log("Evaluation / Judging:");
              if (settings.evaluation?.providerId) {
                const provider = getLLMProvider(settings.evaluation.providerId);
                console.log(
                  `  Provider: ${provider?.name ?? settings.evaluation.providerId} (${provider?.provider ?? "unknown"})`
                );
                console.log(
                  `  Model:    ${settings.evaluation.model ?? "(provider default)"}`
                );
              } else {
                console.log("  (not configured)");
              }

              console.log("");
              console.log("Persona Response Generation:");
              if (settings.persona?.providerId) {
                const provider = getLLMProvider(settings.persona.providerId);
                console.log(
                  `  Provider: ${provider?.name ?? settings.persona.providerId} (${provider?.provider ?? "unknown"})`
                );
                console.log(
                  `  Model:    ${settings.persona.model ?? "(provider default)"}`
                );
              } else {
                console.log("  (uses evaluation settings)");
              }
            }
          })
      )
      .addCommand(
        new Command("set")
          .description("Set LLM provider defaults")
          .argument("<identifier>", "Project ID or name")
          .option(
            "--evaluation-provider <id>",
            "LLM provider ID for evaluation"
          )
          .option("--evaluation-model <model>", "Model for evaluation")
          .option(
            "--persona-provider <id>",
            "LLM provider ID for persona generation"
          )
          .option("--persona-model <model>", "Model for persona generation")
          .option("--json", "Output as JSON")
          .action(
            (
              identifier: string,
              options: {
                evaluationProvider?: string;
                evaluationModel?: string;
                personaProvider?: string;
                personaModel?: string;
                json?: boolean;
              }
            ) => {
              const project =
                getProject(identifier) ?? getProjectByName(identifier);

              if (!project) {
                console.error(`Error: Project "${identifier}" not found`);
                process.exit(1);
              }

              // Resolve provider IDs by name if needed
              const providers = listLLMProviders(project.id);

              const resolveProvider = (
                idOrName: string | undefined
              ): string | undefined => {
                if (!idOrName) return undefined;
                // Check if it's a valid provider ID first
                const byId = providers.find((p) => p.id === idOrName);
                if (byId) return byId.id;
                // Otherwise try by name
                const byName = providers.find((p) => p.name === idOrName);
                if (byName) return byName.id;
                // Return as-is (will fail validation in updateProject)
                return idOrName;
              };

              // Build new settings, merging with existing
              const existingSettings = project.llmSettings ?? {};
              const newSettings: ProjectLLMSettings = {
                evaluation: {
                  providerId:
                    resolveProvider(options.evaluationProvider) ??
                    existingSettings.evaluation?.providerId ??
                    "",
                  model:
                    options.evaluationModel ??
                    existingSettings.evaluation?.model,
                },
                persona: options.personaProvider
                  ? {
                      providerId: resolveProvider(options.personaProvider) ?? "",
                      model:
                        options.personaModel ??
                        existingSettings.persona?.model,
                    }
                  : existingSettings.persona,
              };

              // Clean up empty evaluation settings
              if (!newSettings.evaluation?.providerId) {
                delete newSettings.evaluation;
              }

              try {
                const updated = updateProject(project.id, {
                  llmSettings: newSettings,
                });

                if (!updated) {
                  console.error(`Error: Failed to update project`);
                  process.exit(1);
                }

                if (options.json) {
                  console.log(
                    JSON.stringify(updated.llmSettings ?? {}, null, 2)
                  );
                } else {
                  console.log(`LLM settings updated successfully`);
                  console.log("");

                  const settings = updated.llmSettings;
                  if (settings?.evaluation?.providerId) {
                    const provider = getLLMProvider(
                      settings.evaluation.providerId
                    );
                    console.log("Evaluation:");
                    console.log(
                      `  Provider: ${provider?.name ?? settings.evaluation.providerId}`
                    );
                    console.log(
                      `  Model:    ${settings.evaluation.model ?? "(provider default)"}`
                    );
                  }

                  if (settings?.persona?.providerId) {
                    const provider = getLLMProvider(settings.persona.providerId);
                    console.log("Persona:");
                    console.log(
                      `  Provider: ${provider?.name ?? settings.persona.providerId}`
                    );
                    console.log(
                      `  Model:    ${settings.persona.model ?? "(provider default)"}`
                    );
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
        new Command("clear")
          .description("Clear LLM provider defaults")
          .argument("<identifier>", "Project ID or name")
          .option("--json", "Output as JSON")
          .action((identifier: string, options: { json?: boolean }) => {
            const project =
              getProject(identifier) ?? getProjectByName(identifier);

            if (!project) {
              console.error(`Error: Project "${identifier}" not found`);
              process.exit(1);
            }

            try {
              const updated = updateProject(project.id, {
                llmSettings: null,
              });

              if (!updated) {
                console.error(`Error: Failed to update project`);
                process.exit(1);
              }

              if (options.json) {
                console.log(JSON.stringify({ cleared: true }));
              } else {
                console.log(`LLM settings cleared successfully`);
              }
            } catch (error) {
              if (error instanceof Error) {
                console.error(`Error: ${error.message}`);
                process.exit(1);
              }
              throw error;
            }
          })
      )
  );
