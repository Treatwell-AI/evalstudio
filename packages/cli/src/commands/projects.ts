import { Command } from "commander";
import {
  resolveWorkspace,
  listProjects,
  createProject,
  deleteProject,
  resolveProject,
  getProjectConfig,
  updateProjectConfig,
} from "@evalstudio/core";

export const projectsCommand = new Command("projects")
  .description("Manage projects in the workspace")
  .addCommand(
    new Command("list")
      .description("List all projects")
      .option("--json", "Output as JSON")
      .action((options: { json?: boolean }) => {
        const workspaceDir = resolveWorkspace();
        const projects = listProjects(workspaceDir);

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
            const shortId = project.id.slice(0, 8);
            console.log(`  ${shortId}  ${project.name}`);
          }
        }
      })
  )
  .addCommand(
    new Command("create")
      .description("Create a new project")
      .requiredOption("-n, --name <name>", "Project name")
      .option("--json", "Output as JSON")
      .action((options: { name: string; json?: boolean }) => {
        try {
          const workspaceDir = resolveWorkspace();
          const ctx = createProject(workspaceDir, options.name);

          if (options.json) {
            console.log(JSON.stringify({ id: ctx.id, name: ctx.name }, null, 2));
          } else {
            console.log(`Project created successfully`);
            console.log(`  ID:   ${ctx.id}`);
            console.log(`  Name: ${ctx.name}`);
            console.log();
            console.log(`Switch to it with:`);
            console.log(`  cd projects/${ctx.id}`);
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
  .addCommand(
    new Command("show")
      .description("Show project details")
      .argument("<identifier>", "Project ID (or prefix) or name")
      .option("--json", "Output as JSON")
      .action((identifier: string, options: { json?: boolean }) => {
        const workspaceDir = resolveWorkspace();
        const projects = listProjects(workspaceDir);

        const project = projects.find(
          (p) => p.id === identifier || p.id.startsWith(identifier) || p.name === identifier
        );

        if (!project) {
          console.error(`Error: Project "${identifier}" not found`);
          process.exit(1);
        }

        const ctx = resolveProject(workspaceDir, project.id);
        const config = getProjectConfig(ctx);

        if (options.json) {
          console.log(JSON.stringify({ ...project, config }, null, 2));
        } else {
          console.log(`Project: ${project.name}`);
          console.log(`---------`);
          console.log(`  ID:              ${project.id}`);
          console.log(`  Name:            ${project.name}`);
          if (config.llmSettings) {
            console.log(`  LLM Provider:    ${config.llmSettings.provider}`);
          }
          if (config.maxConcurrency) {
            console.log(`  Max Concurrency: ${config.maxConcurrency}`);
          }
        }
      })
  )
  .addCommand(
    new Command("update")
      .description("Update project configuration")
      .argument("<identifier>", "Project ID (or prefix) or name")
      .option("-n, --name <name>", "New project name")
      .option("--json", "Output as JSON")
      .action(
        (
          identifier: string,
          options: { name?: string; json?: boolean }
        ) => {
          const workspaceDir = resolveWorkspace();
          const projects = listProjects(workspaceDir);

          const project = projects.find(
            (p) => p.id === identifier || p.id.startsWith(identifier) || p.name === identifier
          );

          if (!project) {
            console.error(`Error: Project "${identifier}" not found`);
            process.exit(1);
          }

          try {
            const ctx = resolveProject(workspaceDir, project.id);
            const updated = updateProjectConfig(ctx, {
              name: options.name,
            });

            if (options.json) {
              console.log(JSON.stringify(updated, null, 2));
            } else {
              console.log(`Project updated successfully`);
              console.log(`  ID:   ${project.id}`);
              console.log(`  Name: ${updated.name}`);
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
      .argument("<identifier>", "Project ID (or prefix) or name")
      .option("--json", "Output as JSON")
      .action((identifier: string, options: { json?: boolean }) => {
        const workspaceDir = resolveWorkspace();
        const projects = listProjects(workspaceDir);

        const project = projects.find(
          (p) => p.id === identifier || p.id.startsWith(identifier) || p.name === identifier
        );

        if (!project) {
          console.error(`Error: Project "${identifier}" not found`);
          process.exit(1);
        }

        try {
          deleteProject(workspaceDir, project.id);

          if (options.json) {
            console.log(JSON.stringify({ deleted: true, id: project.id }));
          } else {
            console.log(`Project "${project.name}" deleted successfully`);
          }
        } catch (error) {
          if (error instanceof Error) {
            console.error(`Error: ${error.message}`);
            process.exit(1);
          }
          throw error;
        }
      })
  );

/**
 * Hidden command used by shell integration for `evalstudio use`.
 * Outputs the absolute path to a project directory so the shell function can cd into it.
 */
export const resolveProjectCommand = new Command("_resolve-project")
  .description("Resolve a project directory path (used by shell integration)")
  .argument("<identifier>", "Project ID (or prefix) or name")
  .helpOption(false)
  .action((identifier: string) => {
    try {
      const workspaceDir = resolveWorkspace();
      const projects = listProjects(workspaceDir);

      const project = projects.find(
        (p) => p.id === identifier || p.id.startsWith(identifier) || p.name === identifier
      );

      if (!project) {
        process.exit(1);
      }

      const ctx = resolveProject(workspaceDir, project.id);
      // Output the project directory (parent of dataDir)
      const projectDir = ctx.dataDir.replace(/\/data\/?$/, "");
      console.log(projectDir);
    } catch {
      process.exit(1);
    }
  });
