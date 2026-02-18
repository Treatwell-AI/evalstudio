import { Command } from "commander";
import {
  getDefaultModels,
  resolveProjectFromCwd,
  getProjectConfig,
  updateProjectConfig,
  redactApiKey,
  type ProviderType,
  type LLMSettings,
} from "@evalstudio/core";

const validProviders: ProviderType[] = ["openai", "anthropic"];

function redactLLMSettings(settings: LLMSettings): LLMSettings {
  return {
    ...settings,
    apiKey: redactApiKey(settings.apiKey),
  };
}

export const llmProviderCommand = new Command("llm-provider")
  .description("Manage the LLM provider for persona simulation and evaluation")
  .addCommand(
    new Command("set")
      .description("Set the LLM provider configuration")
      .requiredOption(
        "--provider <provider>",
        "Provider type (openai or anthropic)"
      )
      .requiredOption("--api-key <key>", "API key for the provider")
      .option("--json", "Output as JSON")
      .action(
        (options: {
          provider: string;
          apiKey: string;
          json?: boolean;
        }) => {
          try {
            if (!validProviders.includes(options.provider as ProviderType)) {
              console.error(
                `Error: Invalid provider "${options.provider}". Must be one of: ${validProviders.join(", ")}`
              );
              process.exit(1);
            }

            const ctx = resolveProjectFromCwd();
            // Preserve existing models when updating provider
            const existing = getProjectConfig(ctx);
            const config = updateProjectConfig(ctx, {
              llmSettings: {
                provider: options.provider as ProviderType,
                apiKey: options.apiKey,
                models: existing.llmSettings?.models,
              },
            });

            if (options.json) {
              console.log(JSON.stringify(redactLLMSettings(config.llmSettings!), null, 2));
            } else {
              console.log(`LLM Provider configured successfully`);
              console.log(`  Provider: ${config.llmSettings!.provider}`);
              console.log(`  API Key:  ${redactApiKey(config.llmSettings!.apiKey)}`);
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
    new Command("show")
      .description("Show the current LLM provider configuration")
      .option("--json", "Output as JSON")
      .action((options: { json?: boolean }) => {
        const ctx = resolveProjectFromCwd();
        const config = getProjectConfig(ctx);

        if (!config.llmSettings) {
          if (options.json) {
            console.log(JSON.stringify(null));
          } else {
            console.log("No LLM provider configured.");
            console.log('Use "evalstudio llm-provider set" to configure one.');
          }
          return;
        }

        if (options.json) {
          console.log(JSON.stringify(redactLLMSettings(config.llmSettings), null, 2));
        } else {
          console.log("LLM Provider:");
          console.log("--------------");
          console.log(`  Provider: ${config.llmSettings.provider}`);
          console.log(`  API Key:  ${redactApiKey(config.llmSettings.apiKey)}`);
          if (config.llmSettings.models?.evaluation) {
            console.log(`  Eval Model:    ${config.llmSettings.models.evaluation}`);
          }
          if (config.llmSettings.models?.persona) {
            console.log(`  Persona Model: ${config.llmSettings.models.persona}`);
          }
        }
      })
  )
  .addCommand(
    new Command("models")
      .description("List available models for each provider")
      .option("--provider <provider>", "Filter by provider (openai or anthropic)")
      .option("--json", "Output as JSON")
      .action((options: { provider?: string; json?: boolean }) => {
        const models = getDefaultModels();

        if (
          options.provider &&
          !validProviders.includes(options.provider as ProviderType)
        ) {
          console.error(
            `Error: Invalid provider "${options.provider}". Must be one of: ${validProviders.join(", ")}`
          );
          process.exit(1);
        }

        if (options.json) {
          if (options.provider) {
            console.log(
              JSON.stringify(
                { [options.provider]: models[options.provider as ProviderType] },
                null,
                2
              )
            );
          } else {
            console.log(JSON.stringify(models, null, 2));
          }
        } else {
          console.log("Available Models:");
          console.log("-----------------");

          if (!options.provider || options.provider === "openai") {
            console.log("\nOpenAI:");
            for (const group of models.openai) {
              console.log(`  ${group.label}:`);
              for (const model of group.models) {
                console.log(`    - ${model}`);
              }
            }
          }

          if (!options.provider || options.provider === "anthropic") {
            console.log("\nAnthropic:");
            for (const group of models.anthropic) {
              console.log(`  ${group.label}:`);
              for (const model of group.models) {
                console.log(`    - ${model}`);
              }
            }
          }
        }
      })
  );
