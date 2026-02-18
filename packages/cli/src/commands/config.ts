import { Command } from "commander";
import { getProjectConfig, updateProjectConfig } from "@evalstudio/core";

export const configCommand = new Command("config")
  .description("View or update project configuration")
  .addCommand(
    new Command("show")
      .description("Show current project configuration")
      .option("--json", "Output as JSON")
      .action((options: { json?: boolean }) => {
        const config = getProjectConfig();

        if (options.json) {
          console.log(JSON.stringify(config, null, 2));
        } else {
          console.log("Project Configuration");
          console.log("---------------------");
          console.log(`  Name:            ${config.name}`);
          console.log(`  Version:         ${config.version}`);
          console.log(`  Max Concurrency: ${config.maxConcurrency ?? "3 (default)"}`);
          if (config.llmProvider) {
            console.log(`  LLM Provider:    ${config.llmProvider.provider}`);
          }
          if (config.llmSettings?.evaluation?.model) {
            console.log(`  Eval Model:      ${config.llmSettings.evaluation.model}`);
          }
          if (config.llmSettings?.persona?.model) {
            console.log(`  Persona Model:   ${config.llmSettings.persona.model}`);
          }
        }
      })
  )
  .addCommand(
    new Command("set")
      .description("Update a project configuration value")
      .argument("<key>", "Configuration key (e.g., maxConcurrency, name)")
      .argument("<value>", "Configuration value")
      .option("--json", "Output as JSON")
      .action((key: string, value: string, options: { json?: boolean }) => {
        try {
          let input: Record<string, unknown> = {};

          switch (key) {
            case "maxConcurrency": {
              const num = parseInt(value, 10);
              if (isNaN(num)) {
                console.error("Error: maxConcurrency must be a number");
                process.exit(1);
              }
              input = { maxConcurrency: num };
              break;
            }
            case "name":
              input = { name: value };
              break;
            default:
              console.error(`Error: Unknown configuration key "${key}"`);
              console.error("Available keys: name, maxConcurrency");
              process.exit(1);
          }

          const config = updateProjectConfig(input);

          if (options.json) {
            console.log(JSON.stringify(config, null, 2));
          } else {
            console.log(`Set ${key} = ${value}`);
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
