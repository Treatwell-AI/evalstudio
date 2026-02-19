import { readFileSync } from "node:fs";
import { Command } from "commander";
import {
  resolveProjectFromCwd,
  createProjectModules,
  type Message,
} from "@evalstudio/core";

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

export const scenarioCommand = new Command("scenario")
  .description("Manage test scenarios")
  .addCommand(
    new Command("create")
      .description("Create a new scenario")
      .argument("<name>", "Scenario name")
      .option("-i, --instructions <instructions>", "Instructions for the scenario")
      .option("-m, --messages-file <file>", "Path to JSON file with initial messages")
      .option("--max-messages <number>", "Maximum messages in conversation", parseInt)
      .option("--success-criteria <criteria>", "Criteria for passing the evaluation")
      .option("--failure-criteria <criteria>", "Criteria for failing the evaluation")
      .option("--personas <personas>", "Comma-separated list of persona IDs or names to associate")
      .option("--json", "Output as JSON")
      .action(
        async (
          name: string,
          options: {
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
            const ctx = resolveProjectFromCwd();
            const { scenarios, personas } = createProjectModules(ctx);

            const messages = options.messagesFile
              ? loadMessagesFromFile(options.messagesFile)
              : undefined;

            let personaIds: string[] | undefined;
            if (options.personas) {
              personaIds = [];
              for (const identifier of options.personas.split(",").map(s => s.trim())) {
                const persona = await personas.get(identifier) ?? await personas.getByName(identifier);
                if (!persona) {
                  throw new Error(`Persona "${identifier}" not found`);
                }
                personaIds.push(persona.id);
              }
            }

            const scenario = await scenarios.create({
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
                const names: string[] = [];
                for (const id of scenario.personaIds) {
                  const p = await personas.get(id);
                  names.push(p ? p.name : id);
                }
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
      .option("--json", "Output as JSON")
      .action(async (options: { json?: boolean }) => {
        const ctx = resolveProjectFromCwd();
        const { scenarios, personas } = createProjectModules(ctx);
        const scenarioList = await scenarios.list();

        if (options.json) {
          console.log(JSON.stringify(scenarioList, null, 2));
        } else {
          if (scenarioList.length === 0) {
            console.log("No scenarios found");
            return;
          }

          console.log("Scenarios:");
          console.log("----------");
          for (const scenario of scenarioList) {
            console.log(`  ${scenario.name} (${scenario.id})`);
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
              const names: string[] = [];
              for (const id of scenario.personaIds) {
                const p = await personas.get(id);
                names.push(p ? p.name : id);
              }
              console.log(`    Personas: ${names.join(", ")}`);
            }
          }
        }
      })
  )
  .addCommand(
    new Command("show")
      .description("Show scenario details")
      .argument("<identifier>", "Scenario ID or name")
      .option("--json", "Output as JSON")
      .action(
        async (
          identifier: string,
          options: { json?: boolean }
        ) => {
          const ctx = resolveProjectFromCwd();
          const { scenarios, personas } = createProjectModules(ctx);
          const scenario = await scenarios.get(identifier) ?? await scenarios.getByName(identifier);

          if (!scenario) {
            console.error(`Error: Scenario "${identifier}" not found`);
            process.exit(1);
          }

          if (options.json) {
            console.log(JSON.stringify(scenario, null, 2));
          } else {
            console.log(`Scenario: ${scenario.name}`);
            console.log(`----------`);
            console.log(`  ID:              ${scenario.id}`);
            console.log(`  Name:            ${scenario.name}`);
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
              const names: string[] = [];
              for (const id of scenario.personaIds) {
                const p = await personas.get(id);
                names.push(p ? p.name : id);
              }
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
        async (
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
          const ctx = resolveProjectFromCwd();
          const { scenarios, personas } = createProjectModules(ctx);
          const existing = await scenarios.get(identifier);

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
                personaIds = [];
                for (const identifier of options.personas.split(",").map(s => s.trim())) {
                  const persona = await personas.get(identifier) ?? await personas.getByName(identifier);
                  if (!persona) {
                    throw new Error(`Persona "${identifier}" not found`);
                  }
                  personaIds.push(persona.id);
                }
              }
            }

            const updated = await scenarios.update(existing.id, {
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

            if (options.json) {
              console.log(JSON.stringify(updated, null, 2));
            } else {
              console.log(`Scenario updated successfully`);
              console.log(`  ID:              ${updated.id}`);
              console.log(`  Name:            ${updated.name}`);
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
                const names: string[] = [];
                for (const id of updated.personaIds) {
                  const p = await personas.get(id);
                  names.push(p ? p.name : id);
                }
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
      .action(async (identifier: string, options: { json?: boolean }) => {
        const ctx = resolveProjectFromCwd();
        const { scenarios } = createProjectModules(ctx);
        const existing = await scenarios.get(identifier);

        if (!existing) {
          console.error(`Error: Scenario "${identifier}" not found`);
          process.exit(1);
        }

        const deleted = await scenarios.delete(existing.id);

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
