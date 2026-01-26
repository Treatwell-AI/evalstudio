import { Command } from "commander";
import {
  createPersona,
  deletePersona,
  getPersona,
  getPersonaByName,
  getProject,
  getProjectByName,
  listPersonas,
  updatePersona,
} from "evalstudio";

function resolveProject(identifier: string) {
  return getProject(identifier) ?? getProjectByName(identifier);
}

export const personaCommand = new Command("persona")
  .description("Manage personas for testing scenarios")
  .addCommand(
    new Command("create")
      .description("Create a new persona")
      .argument("<name>", "Persona name")
      .requiredOption("-p, --project <project>", "Project ID or name")
      .option("-d, --description <description>", "Persona description")
      .option("-s, --system-prompt <prompt>", "System prompt for this persona")
      .option("--json", "Output as JSON")
      .action(
        (
          name: string,
          options: {
            project: string;
            description?: string;
            systemPrompt?: string;
            json?: boolean;
          }
        ) => {
          try {
            const project = resolveProject(options.project);
            if (!project) {
              console.error(`Error: Project "${options.project}" not found`);
              process.exit(1);
            }

            const persona = createPersona({
              projectId: project.id,
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
              console.log(`  Project:     ${project.name}`);
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

        const personas = listPersonas(projectId);

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
            const project = getProject(persona.projectId);
            console.log(`  ${persona.name} (${persona.id})`);
            if (project) {
              console.log(`    Project: ${project.name}`);
            }
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
      .argument("<identifier>", "Persona ID")
      .option("-p, --project <project>", "Project ID or name (for lookup by name)")
      .option("--json", "Output as JSON")
      .action(
        (
          identifier: string,
          options: { project?: string; json?: boolean }
        ) => {
          let persona = getPersona(identifier);

          if (!persona && options.project) {
            const project = resolveProject(options.project);
            if (project) {
              persona = getPersonaByName(project.id, identifier);
            }
          }

          if (!persona) {
            console.error(`Error: Persona "${identifier}" not found`);
            process.exit(1);
          }

          const project = getProject(persona.projectId);

          if (options.json) {
            console.log(JSON.stringify(persona, null, 2));
          } else {
            console.log(`Persona: ${persona.name}`);
            console.log(`---------`);
            console.log(`  ID:          ${persona.id}`);
            console.log(`  Name:        ${persona.name}`);
            console.log(`  Project:     ${project?.name ?? persona.projectId}`);
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

            const project = getProject(updated.projectId);

            if (options.json) {
              console.log(JSON.stringify(updated, null, 2));
            } else {
              console.log(`Persona updated successfully`);
              console.log(`  ID:          ${updated.id}`);
              console.log(`  Name:        ${updated.name}`);
              console.log(`  Project:     ${project?.name ?? updated.projectId}`);
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
