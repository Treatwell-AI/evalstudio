import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getProject } from "./project.js";
import { getStorageDir } from "./storage.js";

export type ProviderType = "openai" | "anthropic";

export interface LLMProviderConfig {
  [key: string]: unknown;
}

export interface LLMProvider {
  id: string;
  projectId: string;
  name: string;
  provider: ProviderType;
  apiKey: string;
  config?: LLMProviderConfig;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLLMProviderInput {
  projectId: string;
  name: string;
  provider: ProviderType;
  apiKey: string;
  config?: LLMProviderConfig;
}

export interface UpdateLLMProviderInput {
  name?: string;
  provider?: ProviderType;
  apiKey?: string;
  config?: LLMProviderConfig;
}

function getStoragePath(): string {
  return join(getStorageDir(), "llm-providers.json");
}

function loadLLMProviders(): LLMProvider[] {
  const path = getStoragePath();
  if (!existsSync(path)) {
    return [];
  }
  const data = readFileSync(path, "utf-8");
  return JSON.parse(data) as LLMProvider[];
}

function saveLLMProviders(providers: LLMProvider[]): void {
  const path = getStoragePath();
  writeFileSync(path, JSON.stringify(providers, null, 2));
}

export function createLLMProvider(input: CreateLLMProviderInput): LLMProvider {
  const project = getProject(input.projectId);
  if (!project) {
    throw new Error(`Project with id "${input.projectId}" not found`);
  }

  const providers = loadLLMProviders();

  if (
    providers.some(
      (p) => p.projectId === input.projectId && p.name === input.name
    )
  ) {
    throw new Error(
      `LLM Provider with name "${input.name}" already exists in this project`
    );
  }

  const now = new Date().toISOString();
  const provider: LLMProvider = {
    id: randomUUID(),
    projectId: input.projectId,
    name: input.name,
    provider: input.provider,
    apiKey: input.apiKey,
    config: input.config,
    createdAt: now,
    updatedAt: now,
  };

  providers.push(provider);
  saveLLMProviders(providers);

  return provider;
}

export function getLLMProvider(id: string): LLMProvider | undefined {
  const providers = loadLLMProviders();
  return providers.find((p) => p.id === id);
}

export function getLLMProviderByName(
  projectId: string,
  name: string
): LLMProvider | undefined {
  const providers = loadLLMProviders();
  return providers.find((p) => p.projectId === projectId && p.name === name);
}

export function listLLMProviders(projectId?: string): LLMProvider[] {
  const providers = loadLLMProviders();
  if (projectId) {
    return providers.filter((p) => p.projectId === projectId);
  }
  return providers;
}

export function updateLLMProvider(
  id: string,
  input: UpdateLLMProviderInput
): LLMProvider | undefined {
  const providers = loadLLMProviders();
  const index = providers.findIndex((p) => p.id === id);

  if (index === -1) {
    return undefined;
  }

  const provider = providers[index];

  if (
    input.name &&
    providers.some(
      (p) =>
        p.projectId === provider.projectId && p.name === input.name && p.id !== id
    )
  ) {
    throw new Error(
      `LLM Provider with name "${input.name}" already exists in this project`
    );
  }

  const updated: LLMProvider = {
    ...provider,
    name: input.name ?? provider.name,
    provider: input.provider ?? provider.provider,
    apiKey: input.apiKey ?? provider.apiKey,
    config: input.config ?? provider.config,
    updatedAt: new Date().toISOString(),
  };

  providers[index] = updated;
  saveLLMProviders(providers);

  return updated;
}

export function deleteLLMProvider(id: string): boolean {
  const providers = loadLLMProviders();
  const index = providers.findIndex((p) => p.id === id);

  if (index === -1) {
    return false;
  }

  providers.splice(index, 1);
  saveLLMProviders(providers);

  return true;
}

export function deleteLLMProvidersByProject(projectId: string): number {
  const providers = loadLLMProviders();
  const filtered = providers.filter((p) => p.projectId !== projectId);
  const deletedCount = providers.length - filtered.length;

  if (deletedCount > 0) {
    saveLLMProviders(filtered);
  }

  return deletedCount;
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
 * Fetches available models from the provider's API
 * For OpenAI: uses /v1/models endpoint
 * For Anthropic: returns default list (no public models endpoint)
 */
export async function fetchProviderModels(
  providerId: string
): Promise<string[]> {
  const provider = getLLMProvider(providerId);
  if (!provider) {
    throw new Error(`LLM Provider "${providerId}" not found`);
  }

  if (provider.provider === "openai") {
    return fetchOpenAIModels(provider.apiKey);
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
