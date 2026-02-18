import { readProjectConfig } from "./project.js";

export type ProviderType = "openai" | "anthropic";

export interface LLMProviderConfig {
  [key: string]: unknown;
}

/**
 * LLM provider object used by llm-client.ts for API calls.
 * Constructed from the inline config in evalstudio.config.json.
 */
export interface LLMProvider {
  provider: ProviderType;
  apiKey: string;
  config?: LLMProviderConfig;
}

/**
 * Reads the project config and returns an LLMProvider object.
 * Throws if no provider is configured.
 */
export function getLLMProviderFromConfig(): LLMProvider {
  const config = readProjectConfig();

  if (!config.llmSettings) {
    throw new Error(
      "No LLM provider configured. Configure one in project Settings > LLM Providers."
    );
  }

  return {
    provider: config.llmSettings.provider,
    apiKey: config.llmSettings.apiKey,
  };
}

export interface ModelGroup {
  label: string;
  models: string[];
}

/**
 * Returns available models for each provider, grouped by tier.
 */
export function getDefaultModels(): Record<ProviderType, ModelGroup[]> {
  return {
    openai: [
      {
        label: "Standard",
        models: [
          "gpt-5-mini",
          "gpt-5-nano",
          "gpt-4.1",
          "gpt-4.1-mini",
          "gpt-4.1-nano",
          "o4-mini",
          "o3-mini",
          "gpt-4o",
          "gpt-4o-mini",
        ],
      },
      {
        label: "Premium",
        models: [
          "gpt-5.2-pro",
          "gpt-5.2",
          "gpt-5.1",
          "gpt-5-pro",
          "gpt-5",
          "o3-pro",
          "o3",
          "o1-pro",
          "o1",
        ],
      },
    ],
    anthropic: [
      {
        label: "Standard",
        models: [
          "claude-sonnet-4-5-20250929",
          "claude-sonnet-4-20250514",
          "claude-3-5-sonnet-20241022",
          "claude-3-5-haiku-20241022",
        ],
      },
      {
        label: "Premium",
        models: [
          "claude-opus-4-5-20251101",
          "claude-opus-4-20250514",
        ],
      },
    ],
  };
}
