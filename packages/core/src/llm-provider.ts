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

  if (!config.llmProvider) {
    throw new Error(
      "No LLM provider configured. Configure one in project Settings > LLM Providers."
    );
  }

  return {
    provider: config.llmProvider.provider,
    apiKey: config.llmProvider.apiKey,
  };
}

/**
 * Returns the default/fallback models for each provider type
 * Used when API fetching fails or for Anthropic (which doesn't have a models endpoint)
 */
export function getDefaultModels(): Record<ProviderType, string[]> {
  return {
    openai: [
      "gpt-4.1",
      "gpt-4.1-mini",
      "gpt-4.1-nano",
      "o3",
      "o4-mini",
      "o3-mini",
      "o1",
      "o1-mini",
      "gpt-4o",
      "gpt-4o-mini",
    ],
    anthropic: [
      "claude-opus-4-5-20251101",
      "claude-sonnet-4-5-20250929",
      "claude-opus-4-20250514",
      "claude-sonnet-4-20250514",
      "claude-3-5-sonnet-20241022",
      "claude-3-5-haiku-20241022",
    ],
  };
}

/**
 * Fetches available models from the provider's API.
 * Uses the project's configured provider credentials.
 * For OpenAI: uses /v1/models endpoint
 * For Anthropic: returns default list (no public models endpoint)
 */
export async function fetchProviderModels(
  providerType: ProviderType,
  apiKey: string,
): Promise<string[]> {
  if (providerType === "openai") {
    return fetchOpenAIModels(apiKey);
  }

  // Anthropic doesn't have a public models endpoint, use defaults
  return getDefaultModels().anthropic;
}

/**
 * Fetches models from OpenAI API and filters for chat-capable models
 */
async function fetchOpenAIModels(apiKey: string): Promise<string[]> {
  const response = await fetch("https://api.openai.com/v1/models", {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch OpenAI models: ${response.statusText}`);
  }

  const data = (await response.json()) as {
    data: Array<{ id: string; owned_by: string }>;
  };

  // Filter for chat/completion models and sort by preference
  const chatModels = data.data
    .map((m) => m.id)
    .filter((id) => {
      // Include GPT models, O-series reasoning models
      return (
        id.startsWith("gpt-") ||
        id.startsWith("o1") ||
        id.startsWith("o3") ||
        id.startsWith("o4")
      );
    })
    .filter((id) => {
      // Exclude internal/preview variants
      return (
        !id.includes("preview") &&
        !id.includes("realtime") &&
        !id.includes("audio") &&
        !id.includes("transcribe") &&
        !id.includes("tts") &&
        !id.includes("whisper") &&
        !id.includes("dall-e") &&
        !id.includes("embedding")
      );
    })
    .sort((a, b) => {
      // Sort: gpt-4.1 > o-series > gpt-4o > gpt-4 > gpt-3.5
      const order = (id: string) => {
        if (id.startsWith("gpt-4.1")) return 0;
        if (id.startsWith("o3") || id.startsWith("o4")) return 1;
        if (id.startsWith("o1")) return 2;
        if (id.startsWith("gpt-4o")) return 3;
        if (id.startsWith("gpt-4")) return 4;
        return 5;
      };
      return order(a) - order(b) || a.localeCompare(b);
    });

  return chatModels;
}
