import { Command } from "commander";
import { resolveProjectFromCwd, getProjectConfig, updateProjectConfig, createStorageProvider, redactApiKey, type ProjectConfig } from "@evalstudio/core";

function redactConfig(config: ProjectConfig): ProjectConfig {
  if (!config.llmSettings?.apiKey) return config;
  return {
    ...config,
    llmSettings: {
      ...config.llmSettings,
      apiKey: redactApiKey(config.llmSettings.apiKey),
    },
  };
}

export const configCommand = new Command("config")
  .description("View or update project configuration")
  .addCommand(
    new Command("show")
      .description("Show current project configuration")
      .option("--json", "Output as JSON")
      .action(async (options: { json?: boolean }) => {
        const ctx = resolveProjectFromCwd();
        const storage = await createStorageProvider(ctx.workspaceDir);
        const config = await getProjectConfig(storage, ctx.workspaceDir, ctx.id);

        if (options.json) {
          console.log(JSON.stringify(redactConfig(config), null, 2));
        } else {
          console.log("Project Configuration");
          console.log("---------------------");
          console.log(`  Name:            ${config.name}`);
          console.log(`  Version:         ${config.version}`);
          console.log(`  Max Concurrency: ${config.maxConcurrency ?? "3 (default)"}`);
          if (config.llmSettings) {
            console.log(`  LLM Provider:    ${config.llmSettings.provider}`);
          }
          if (config.llmSettings?.models?.evaluation) {
            console.log(`  Eval Model:      ${config.llmSettings.models.evaluation}`);
          }
          if (config.llmSettings?.models?.persona) {
            console.log(`  Persona Model:   ${config.llmSettings.models.persona}`);
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
      .action(async (key: string, value: string, options: { json?: boolean }) => {
        try {
          const ctx = resolveProjectFromCwd();
          const storage = await createStorageProvider(ctx.workspaceDir);
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

          const config = await updateProjectConfig(storage, ctx.workspaceDir, ctx.id, input);

          if (options.json) {
            console.log(JSON.stringify(redactConfig(config), null, 2));
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
