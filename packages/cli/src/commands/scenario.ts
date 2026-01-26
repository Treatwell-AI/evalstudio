import { readFileSync } from "node:fs";
import { Command } from "commander";
import {
  createScenario,
  deleteScenario,
  getScenario,
  getScenarioByName,
  getProject,
  getProjectByName,
  getPersona,
  getPersonaByName,
  listPersonas,
  listScenarios,
  updateScenario,
  type Message,
} from "evalstudio";

function loadMessagesFromFile(filePath: string): Message[] {
  try {
    const content = readFileSync(filePath, "utf-8");
    const messages = JSON.parse(content);
    if (!Array.isArray(messages)) {
      throw new Error("Messages file must contain a JSON array");
    }
    return messages;
  } catch (error) {
    if (error instanceof Error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new Error(`Messages file not found: ${filePath}`);
      }
      throw new Error(`Failed to load messages file: ${error.message}`);
    }
    throw error;
  }
}

function resolveProject(identifier: string) {
  return getProject(identifier) ?? getProjectByName(identifier);
}

function resolvePersonaIds(identifiers: string[], projectId: string): string[] {
  const ids: string[] = [];
  for (const identifier of identifiers) {
    const persona = getPersona(identifier) ?? getPersonaByName(projectId, identifier);
    if (!persona) {
      throw new Error(`Persona "${identifier}" not found`);
    }
    ids.push(persona.id);
  }
  return ids;
}

function getPersonaNames(personaIds: string[]): string[] {
  const names: string[] = [];
  for (const id of personaIds) {
    const persona = getPersona(id);
    names.push(persona ? persona.name : id);
  }
  return names;
}

export const scenarioCommand = new Command("scenario")
  .description("Manage test scenarios")
  .addCommand(
    new Command("create")
      .description("Create a new scenario")
      .argument("<name>", "Scenario name")
      .requiredOption("-p, --project <project>", "Project ID or name")
      .option("-i, --instructions <instructions>", "Instructions for the scenario")
      .option("-m, --messages-file <file>", "Path to JSON file with initial messages")
      .option("--max-messages <number>", "Maximum messages in conversation", parseInt)
      .option("--success-criteria <criteria>", "Criteria for passing the evaluation")
      .option("--failure-criteria <criteria>", "Criteria for failing the evaluation")
      .option("--personas <personas>", "Comma-separated list of persona IDs or names to associate")
      .option("--json", "Output as JSON")
      .action(
        (
          name: string,
          options: {
            project: string;
            instructions?: string;
            messagesFile?: string;
            maxMessages?: number;
            successCriteria?: string;
            failureCriteria?: string;
            personas?: string;
            json?: boolean;
          }
        ) => {
          try {
            const project = resolveProject(options.project);
            if (!project) {
              console.error(`Error: Project "${options.project}" not found`);
              process.exit(1);
            }

            const messages = options.messagesFile
              ? loadMessagesFromFile(options.messagesFile)
              : undefined;

            const personaIds = options.personas
              ? resolvePersonaIds(options.personas.split(",").map(s => s.trim()), project.id)
              : undefined;

            const scenario = createScenario({
              projectId: project.id,
              name,
              instructions: options.instructions,
              messages,
              maxMessages: options.maxMessages,
              successCriteria: options.successCriteria,
              failureCriteria: options.failureCriteria,
              personaIds,
            });

            if (options.json) {
              console.log(JSON.stringify(scenario, null, 2));
            } else {
              console.log(`Scenario created successfully`);
              console.log(`  ID:              ${scenario.id}`);
              console.log(`  Name:            ${scenario.name}`);
              console.log(`  Project:         ${project.name}`);
              if (scenario.instructions) {
                console.log(`  Instructions:    ${scenario.instructions}`);
              }
              if (scenario.messages && scenario.messages.length > 0) {
                console.log(`  Messages:        ${scenario.messages.length} initial messages`);
              }
              if (scenario.maxMessages) {
                console.log(`  Max Messages:    ${scenario.maxMessages}`);
              }
              if (scenario.successCriteria) {
                console.log(`  Success:         ${scenario.successCriteria}`);
              }
              if (scenario.failureCriteria) {
                console.log(`  Failure:         ${scenario.failureCriteria}`);
              }
              if (scenario.personaIds && scenario.personaIds.length > 0) {
                const names = getPersonaNames(scenario.personaIds);
                console.log(`  Personas:        ${names.join(", ")}`);
              }
              console.log(`  Created:         ${scenario.createdAt}`);
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
      .description("List scenarios")
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

        const scenarios = listScenarios(projectId);

        if (options.json) {
          console.log(JSON.stringify(scenarios, null, 2));
        } else {
          if (scenarios.length === 0) {
            console.log("No scenarios found");
            return;
          }

          console.log("Scenarios:");
          console.log("----------");
          for (const scenario of scenarios) {
            const project = getProject(scenario.projectId);
            console.log(`  ${scenario.name} (${scenario.id})`);
            if (project) {
              console.log(`    Project: ${project.name}`);
            }
            if (scenario.instructions) {
              const preview = scenario.instructions.length > 60
                ? scenario.instructions.slice(0, 60) + "..."
                : scenario.instructions;
              console.log(`    ${preview}`);
            }
            if (scenario.messages && scenario.messages.length > 0) {
              console.log(`    Messages: ${scenario.messages.length} initial messages`);
            }
            if (scenario.personaIds && scenario.personaIds.length > 0) {
              const names = getPersonaNames(scenario.personaIds);
              console.log(`    Personas: ${names.join(", ")}`);
            }
          }
        }
      })
  )
  .addCommand(
    new Command("show")
      .description("Show scenario details")
      .argument("<identifier>", "Scenario ID")
      .option("-p, --project <project>", "Project ID or name (for lookup by name)")
      .option("--json", "Output as JSON")
      .action(
        (
          identifier: string,
          options: { project?: string; json?: boolean }
        ) => {
          let scenario = getScenario(identifier);

          if (!scenario && options.project) {
            const project = resolveProject(options.project);
            if (project) {
              scenario = getScenarioByName(project.id, identifier);
            }
          }

          if (!scenario) {
            console.error(`Error: Scenario "${identifier}" not found`);
            process.exit(1);
          }

          const project = getProject(scenario.projectId);

          if (options.json) {
            console.log(JSON.stringify(scenario, null, 2));
          } else {
            console.log(`Scenario: ${scenario.name}`);
            console.log(`----------`);
            console.log(`  ID:              ${scenario.id}`);
            console.log(`  Name:            ${scenario.name}`);
            console.log(`  Project:         ${project?.name ?? scenario.projectId}`);
            if (scenario.instructions) {
              console.log(`  Instructions:    ${scenario.instructions}`);
            }
            if (scenario.messages && scenario.messages.length > 0) {
              console.log(`  Messages:        ${scenario.messages.length} initial messages`);
              for (const msg of scenario.messages) {
                const preview = typeof msg.content === "string" && msg.content.length > 50
                  ? msg.content.slice(0, 50) + "..."
                  : msg.content;
                console.log(`                   [${msg.role}] ${preview}`);
              }
            }
            if (scenario.maxMessages) {
              console.log(`  Max Messages:    ${scenario.maxMessages}`);
            }
            if (scenario.successCriteria) {
              console.log(`  Success:         ${scenario.successCriteria}`);
            }
            if (scenario.failureCriteria) {
              console.log(`  Failure:         ${scenario.failureCriteria}`);
            }
            if (scenario.personaIds && scenario.personaIds.length > 0) {
              const names = getPersonaNames(scenario.personaIds);
              console.log(`  Personas:        ${names.join(", ")}`);
            }
            console.log(`  Created:         ${scenario.createdAt}`);
            console.log(`  Updated:         ${scenario.updatedAt}`);
          }
        }
      )
  )
  .addCommand(
    new Command("update")
      .description("Update a scenario")
      .argument("<identifier>", "Scenario ID")
      .option("-n, --name <name>", "New scenario name")
      .option("-i, --instructions <instructions>", "New instructions")
      .option("-m, --messages-file <file>", "Path to JSON file with initial messages")
      .option("--max-messages <number>", "Maximum messages in conversation", parseInt)
      .option("--success-criteria <criteria>", "Criteria for passing the evaluation")
      .option("--failure-criteria <criteria>", "Criteria for failing the evaluation")
      .option("--personas <personas>", "Comma-separated list of persona IDs or names (use empty string to clear)")
      .option("--json", "Output as JSON")
      .action(
        (
          identifier: string,
          options: {
            name?: string;
            instructions?: string;
            messagesFile?: string;
            maxMessages?: number;
            successCriteria?: string;
            failureCriteria?: string;
            personas?: string;
            json?: boolean;
          }
        ) => {
          const existing = getScenario(identifier);

          if (!existing) {
            console.error(`Error: Scenario "${identifier}" not found`);
            process.exit(1);
          }

          try {
            const messages = options.messagesFile
              ? loadMessagesFromFile(options.messagesFile)
              : undefined;

            let personaIds: string[] | undefined;
            if (options.personas !== undefined) {
              if (options.personas === "") {
                personaIds = [];
              } else {
                personaIds = resolvePersonaIds(options.personas.split(",").map(s => s.trim()), existing.projectId);
              }
            }

            const updated = updateScenario(existing.id, {
              name: options.name,
              instructions: options.instructions,
              messages,
              maxMessages: options.maxMessages,
              successCriteria: options.successCriteria,
              failureCriteria: options.failureCriteria,
              personaIds,
            });

            if (!updated) {
              console.error(`Error: Failed to update scenario`);
              process.exit(1);
            }

            const project = getProject(updated.projectId);

            if (options.json) {
              console.log(JSON.stringify(updated, null, 2));
            } else {
              console.log(`Scenario updated successfully`);
              console.log(`  ID:              ${updated.id}`);
              console.log(`  Name:            ${updated.name}`);
              console.log(`  Project:         ${project?.name ?? updated.projectId}`);
              if (updated.instructions) {
                console.log(`  Instructions:    ${updated.instructions}`);
              }
              if (updated.messages && updated.messages.length > 0) {
                console.log(`  Messages:        ${updated.messages.length} initial messages`);
              }
              if (updated.maxMessages) {
                console.log(`  Max Messages:    ${updated.maxMessages}`);
              }
              if (updated.successCriteria) {
                console.log(`  Success:         ${updated.successCriteria}`);
              }
              if (updated.failureCriteria) {
                console.log(`  Failure:         ${updated.failureCriteria}`);
              }
              if (updated.personaIds && updated.personaIds.length > 0) {
                const names = getPersonaNames(updated.personaIds);
                console.log(`  Personas:        ${names.join(", ")}`);
              }
              console.log(`  Updated:         ${updated.updatedAt}`);
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
      .description("Delete a scenario")
      .argument("<identifier>", "Scenario ID")
      .option("--json", "Output as JSON")
      .action((identifier: string, options: { json?: boolean }) => {
        const existing = getScenario(identifier);

        if (!existing) {
          console.error(`Error: Scenario "${identifier}" not found`);
          process.exit(1);
        }

        const deleted = deleteScenario(existing.id);

        if (!deleted) {
          console.error(`Error: Failed to delete scenario`);
          process.exit(1);
        }

        if (options.json) {
          console.log(JSON.stringify({ deleted: true, id: existing.id }));
        } else {
          console.log(`Scenario "${existing.name}" deleted successfully`);
        }
      })
  );
