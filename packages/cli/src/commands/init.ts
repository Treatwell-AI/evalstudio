import { basename } from "node:path";
import { Command } from "commander";
import { initLocalProject } from "@evalstudio/core";

export const initCommand = new Command("init")
  .description("Initialize a new EvalStudio project in the current directory")
  .argument("[name]", "Project name (defaults to directory name)")
  .option("--json", "Output as JSON")
  .action((name: string | undefined, options: { json?: boolean }) => {
    try {
      const projectName = name ?? basename(process.cwd());
      const result = initLocalProject(process.cwd(), projectName);

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`Initialized EvalStudio project in ${result.projectDir}`);
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
