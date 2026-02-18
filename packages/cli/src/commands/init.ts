import { basename } from "node:path";
import { Command } from "commander";
import { initWorkspace } from "@evalstudio/core";

export const initCommand = new Command("init")
  .description("Initialize a new EvalStudio workspace in the current directory")
  .argument("[name]", "Workspace name (defaults to directory name)")
  .option("--project <name>", "Name of the first project (defaults to 'My Project')")
  .option("--json", "Output as JSON")
  .action((name: string | undefined, options: { project?: string; json?: boolean }) => {
    try {
      const workspaceName = name ?? basename(process.cwd());
      const projectName = options.project ?? "My Project";
      const result = initWorkspace(process.cwd(), workspaceName, projectName);

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`Initialized EvalStudio workspace in ${result.workspaceDir}`);
        console.log(`  Project: ${result.project.name} (${result.project.id.slice(0, 8)})`);
        console.log();
        console.log(`  evalstudio status`);
        console.log(`  evalstudio serve`);
      }
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
      }
      throw error;
    }
  });
