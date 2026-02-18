import { Command } from "commander";
import {
  getDefaultModels,
  getProjectConfig,
  updateProjectConfig,
  type ProviderType,
} from "@evalstudio/core";

const validProviders: ProviderType[] = ["openai", "anthropic"];

function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 8) {
    return "****";
  }
  return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
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

            const config = updateProjectConfig({
              llmProvider: {
                provider: options.provider as ProviderType,
                apiKey: options.apiKey,
              },
            });

            if (options.json) {
              console.log(JSON.stringify(config.llmProvider, null, 2));
            } else {
              console.log(`LLM Provider configured successfully`);
              console.log(`  Provider: ${config.llmProvider!.provider}`);
              console.log(`  API Key:  ${maskApiKey(config.llmProvider!.apiKey)}`);
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
        const config = getProjectConfig();

        if (!config.llmProvider) {
          if (options.json) {
            console.log(JSON.stringify(null));
          } else {
            console.log("No LLM provider configured.");
            console.log('Use "evalstudio llm-provider set" to configure one.');
          }
          return;
        }

        if (options.json) {
          console.log(JSON.stringify(config.llmProvider, null, 2));
        } else {
          console.log("LLM Provider:");
          console.log("--------------");
          console.log(`  Provider: ${config.llmProvider.provider}`);
          console.log(`  API Key:  ${maskApiKey(config.llmProvider.apiKey)}`);
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
            for (const model of models.openai) {
              console.log(`  - ${model}`);
            }
          }

          if (!options.provider || options.provider === "anthropic") {
            console.log("\nAnthropic:");
            for (const model of models.anthropic) {
              console.log(`  - ${model}`);
            }
          }
        }
      })
  );
