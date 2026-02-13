import { Command } from "commander";
import {
  createPersona,
  deletePersona,
  getPersona,
  getPersonaByName,
  listPersonas,
  updatePersona,
} from "@evalstudio/core";

export const personaCommand = new Command("persona")
  .description("Manage personas for testing scenarios")
  .addCommand(
    new Command("create")
      .description("Create a new persona")
      .argument("<name>", "Persona name")
      .option("-d, --description <description>", "Persona description")
      .option("-s, --system-prompt <prompt>", "System prompt for this persona")
      .option("--json", "Output as JSON")
      .action(
        (
          name: string,
          options: {
            description?: string;
            systemPrompt?: string;
            json?: boolean;
          }
        ) => {
          try {
            const persona = createPersona({
              name,
              description: options.description,
              systemPrompt: options.systemPrompt,
            });

            if (options.json) {
              console.log(JSON.stringify(persona, null, 2));
            } else {
              console.log(`Persona created successfully`);
              console.log(`  ID:          ${persona.id}`);
              console.log(`  Name:        ${persona.name}`);
              if (persona.description) {
                console.log(`  Description: ${persona.description}`);
              }
              if (persona.systemPrompt) {
                console.log(`  System:      ${persona.systemPrompt}`);
              }
              console.log(`  Created:     ${persona.createdAt}`);
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
      .description("List personas")
      .option("--json", "Output as JSON")
      .action((options: { json?: boolean }) => {
        const personas = listPersonas();

        if (options.json) {
          console.log(JSON.stringify(personas, null, 2));
        } else {
          if (personas.length === 0) {
            console.log("No personas found");
            return;
          }

          console.log("Personas:");
          console.log("---------");
          for (const persona of personas) {
            console.log(`  ${persona.name} (${persona.id})`);
            if (persona.description) {
              console.log(`    ${persona.description}`);
            }
          }
        }
      })
  )
  .addCommand(
    new Command("show")
      .description("Show persona details")
      .argument("<identifier>", "Persona ID or name")
      .option("--json", "Output as JSON")
      .action(
        (
          identifier: string,
          options: { json?: boolean }
        ) => {
          const persona = getPersona(identifier) ?? getPersonaByName(identifier);

          if (!persona) {
            console.error(`Error: Persona "${identifier}" not found`);
            process.exit(1);
          }

          if (options.json) {
            console.log(JSON.stringify(persona, null, 2));
          } else {
            console.log(`Persona: ${persona.name}`);
            console.log(`---------`);
            console.log(`  ID:          ${persona.id}`);
            console.log(`  Name:        ${persona.name}`);
            if (persona.description) {
              console.log(`  Description: ${persona.description}`);
            }
            if (persona.systemPrompt) {
              console.log(`  System:      ${persona.systemPrompt}`);
            }
            console.log(`  Created:     ${persona.createdAt}`);
            console.log(`  Updated:     ${persona.updatedAt}`);
          }
        }
      )
  )
  .addCommand(
    new Command("update")
      .description("Update a persona")
      .argument("<identifier>", "Persona ID")
      .option("-n, --name <name>", "New persona name")
      .option("-d, --description <description>", "New persona description")
      .option("-s, --system-prompt <prompt>", "New system prompt")
      .option("--json", "Output as JSON")
      .action(
        (
          identifier: string,
          options: {
            name?: string;
            description?: string;
            systemPrompt?: string;
            json?: boolean;
          }
        ) => {
          const existing = getPersona(identifier);

          if (!existing) {
            console.error(`Error: Persona "${identifier}" not found`);
            process.exit(1);
          }

          try {
            const updated = updatePersona(existing.id, {
              name: options.name,
              description: options.description,
              systemPrompt: options.systemPrompt,
            });

            if (!updated) {
              console.error(`Error: Failed to update persona`);
              process.exit(1);
            }

            if (options.json) {
              console.log(JSON.stringify(updated, null, 2));
            } else {
              console.log(`Persona updated successfully`);
              console.log(`  ID:          ${updated.id}`);
              console.log(`  Name:        ${updated.name}`);
              if (updated.description) {
                console.log(`  Description: ${updated.description}`);
              }
              if (updated.systemPrompt) {
                console.log(`  System:      ${updated.systemPrompt}`);
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
      .description("Delete a persona")
      .argument("<identifier>", "Persona ID")
      .option("--json", "Output as JSON")
      .action((identifier: string, options: { json?: boolean }) => {
        const existing = getPersona(identifier);

        if (!existing) {
          console.error(`Error: Persona "${identifier}" not found`);
          process.exit(1);
        }

        const deleted = deletePersona(existing.id);

        if (!deleted) {
          console.error(`Error: Failed to delete persona`);
          process.exit(1);
        }

        if (options.json) {
          console.log(JSON.stringify({ deleted: true, id: existing.id }));
        } else {
          console.log(`Persona "${existing.name}" deleted successfully`);
        }
      })
  );
