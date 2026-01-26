import { Command } from "commander";
import { initLocalProject } from "evalstudio";

export const initCommand = new Command("init")
  .description("Initialize a new EvalStudio project directory")
  .argument("<name>", "Name of the directory to create")
  .option("--json", "Output as JSON")
  .action((name: string, options: { json?: boolean }) => {
    try {
      const result = initLocalProject(process.cwd(), name);

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`Initialized EvalStudio project in ${result.projectDir}`);
        console.log();
        console.log(`  cd ${name}`);
        console.log(`  evalstudio project create --name "My Project"`);
      }
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
      }
      throw error;
    }
  });
