import { Command } from "commander";
import {
  createLLMProvider,
  deleteLLMProvider,
  getDefaultModels,
  getLLMProvider,
  getLLMProviderByName,
  listLLMProviders,
  updateLLMProvider,
  type ProviderType,
} from "@evalstudio/core";

const validProviders: ProviderType[] = ["openai", "anthropic"];

export const llmProviderCommand = new Command("llm-provider")
  .description("Manage LLM providers for persona simulation and evaluation")
  .addCommand(
    new Command("create")
      .description("Create a new LLM provider configuration")
      .argument("<name>", "Provider configuration name")
      .requiredOption(
        "--provider <provider>",
        "Provider type (openai or anthropic)"
      )
      .requiredOption("--api-key <key>", "API key for the provider")
      .option("--json", "Output as JSON")
      .action(
        (
          name: string,
          options: {
            provider: string;
            apiKey: string;
            json?: boolean;
          }
        ) => {
          try {
            if (!validProviders.includes(options.provider as ProviderType)) {
              console.error(
                `Error: Invalid provider "${options.provider}". Must be one of: ${validProviders.join(", ")}`
              );
              process.exit(1);
            }

            const provider = createLLMProvider({
              name,
              provider: options.provider as ProviderType,
              apiKey: options.apiKey,
            });

            if (options.json) {
              console.log(JSON.stringify(provider, null, 2));
            } else {
              console.log(`LLM Provider created successfully`);
              console.log(`  ID:       ${provider.id}`);
              console.log(`  Name:     ${provider.name}`);
              console.log(`  Provider: ${provider.provider}`);
              console.log(`  API Key:  ${maskApiKey(provider.apiKey)}`);
              if (provider.config) {
                console.log(`  Config:   ${JSON.stringify(provider.config)}`);
              }
              console.log(`  Created:  ${provider.createdAt}`);
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
      .description("List LLM provider configurations")
      .option("--json", "Output as JSON")
      .action((options: { json?: boolean }) => {
        const providers = listLLMProviders();

        if (options.json) {
          console.log(JSON.stringify(providers, null, 2));
        } else {
          if (providers.length === 0) {
            console.log("No LLM providers found");
            return;
          }

          console.log("LLM Providers:");
          console.log("--------------");
          for (const provider of providers) {
            console.log(`  ${provider.name} (${provider.id})`);
            console.log(`    Provider: ${provider.provider}`);
          }
        }
      })
  )
  .addCommand(
    new Command("show")
      .description("Show LLM provider details")
      .argument("<identifier>", "Provider ID or name")
      .option("--json", "Output as JSON")
      .action(
        (
          identifier: string,
          options: { json?: boolean }
        ) => {
          const provider = getLLMProvider(identifier) ?? getLLMProviderByName(identifier);

          if (!provider) {
            console.error(`Error: LLM Provider "${identifier}" not found`);
            process.exit(1);
          }

          if (options.json) {
            console.log(JSON.stringify(provider, null, 2));
          } else {
            console.log(`LLM Provider: ${provider.name}`);
            console.log(`--------------`);
            console.log(`  ID:       ${provider.id}`);
            console.log(`  Name:     ${provider.name}`);
            console.log(`  Provider: ${provider.provider}`);
            console.log(`  API Key:  ${maskApiKey(provider.apiKey)}`);
            if (provider.config) {
              console.log(`  Config:   ${JSON.stringify(provider.config)}`);
            }
            console.log(`  Created:  ${provider.createdAt}`);
            console.log(`  Updated:  ${provider.updatedAt}`);
          }
        }
      )
  )
  .addCommand(
    new Command("update")
      .description("Update an LLM provider configuration")
      .argument("<identifier>", "Provider ID")
      .option("-n, --name <name>", "New provider name")
      .option("--provider <provider>", "New provider type (openai or anthropic)")
      .option("--api-key <key>", "New API key")
      .option("--json", "Output as JSON")
      .action(
        (
          identifier: string,
          options: {
            name?: string;
            provider?: string;
            apiKey?: string;
            json?: boolean;
          }
        ) => {
          const existing = getLLMProvider(identifier);

          if (!existing) {
            console.error(`Error: LLM Provider "${identifier}" not found`);
            process.exit(1);
          }

          if (
            options.provider &&
            !validProviders.includes(options.provider as ProviderType)
          ) {
            console.error(
              `Error: Invalid provider "${options.provider}". Must be one of: ${validProviders.join(", ")}`
            );
            process.exit(1);
          }

          try {
            const updated = updateLLMProvider(existing.id, {
              name: options.name,
              provider: options.provider as ProviderType | undefined,
              apiKey: options.apiKey,
            });

            if (!updated) {
              console.error(`Error: Failed to update LLM provider`);
              process.exit(1);
            }

            if (options.json) {
              console.log(JSON.stringify(updated, null, 2));
            } else {
              console.log(`LLM Provider updated successfully`);
              console.log(`  ID:       ${updated.id}`);
              console.log(`  Name:     ${updated.name}`);
              console.log(`  Provider: ${updated.provider}`);
              console.log(`  API Key:  ${maskApiKey(updated.apiKey)}`);
              if (updated.config) {
                console.log(`  Config:   ${JSON.stringify(updated.config)}`);
              }
              console.log(`  Updated:  ${updated.updatedAt}`);
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
      .description("Delete an LLM provider configuration")
      .argument("<identifier>", "Provider ID")
      .option("--json", "Output as JSON")
      .action((identifier: string, options: { json?: boolean }) => {
        const existing = getLLMProvider(identifier);

        if (!existing) {
          console.error(`Error: LLM Provider "${identifier}" not found`);
          process.exit(1);
        }

        const deleted = deleteLLMProvider(existing.id);

        if (!deleted) {
          console.error(`Error: Failed to delete LLM provider`);
          process.exit(1);
        }

        if (options.json) {
          console.log(JSON.stringify({ deleted: true, id: existing.id }));
        } else {
          console.log(`LLM Provider "${existing.name}" deleted successfully`);
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

function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 8) {
    return "****";
  }
  return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
}
