import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getLLMProvider } from "./llm-provider.js";
import {
  CONFIG_FILENAME,
  readProjectConfig,
  writeProjectConfig,
  type ProjectConfig,
  type ProjectLLMSettings,
  type LLMUseCaseSettings,
} from "./storage.js";

// Re-export types from storage
export type { ProjectConfig, ProjectLLMSettings, LLMUseCaseSettings };

export interface UpdateProjectConfigInput {
  name?: string;
  /** Set to null to clear LLM settings */
  llmSettings?: ProjectLLMSettings | null;
  /** Maximum concurrent run executions. Set to null to clear (revert to default). */
  maxConcurrency?: number | null;
}

/**
 * Reads the current project configuration from evalstudio.config.json.
 */
export function getProjectConfig(): ProjectConfig {
  return readProjectConfig();
}

/**
 * Updates the project configuration in evalstudio.config.json.
 */
export function updateProjectConfig(
  input: UpdateProjectConfigInput
): ProjectConfig {
  const config = readProjectConfig();

  // Validate LLM settings if provided
  if (input.llmSettings) {
    const { evaluation, persona } = input.llmSettings;
    if (evaluation?.providerId) {
      const provider = getLLMProvider(evaluation.providerId);
      if (!provider) {
        throw new Error(
          `LLM Provider with id "${evaluation.providerId}" not found`
        );
      }
    }
    if (persona?.providerId) {
      const provider = getLLMProvider(persona.providerId);
      if (!provider) {
        throw new Error(
          `LLM Provider with id "${persona.providerId}" not found`
        );
      }
    }
  }

  // Handle llmSettings: null clears, undefined keeps existing, object updates
  let newLLMSettings: ProjectLLMSettings | undefined;
  if (input.llmSettings === null) {
    newLLMSettings = undefined;
  } else if (input.llmSettings !== undefined) {
    newLLMSettings = input.llmSettings;
  } else {
    newLLMSettings = config.llmSettings;
  }

  // Handle maxConcurrency: null clears, undefined keeps existing, number updates
  let newMaxConcurrency: number | undefined;
  if (input.maxConcurrency === null) {
    newMaxConcurrency = undefined;
  } else if (input.maxConcurrency !== undefined) {
    if (input.maxConcurrency < 1) {
      throw new Error("maxConcurrency must be at least 1");
    }
    newMaxConcurrency = input.maxConcurrency;
  } else {
    newMaxConcurrency = config.maxConcurrency;
  }

  const updated: ProjectConfig = {
    ...config,
    name: input.name ?? config.name,
    llmSettings: newLLMSettings,
    maxConcurrency: newMaxConcurrency,
  };

  writeProjectConfig(updated);
  return updated;
}

export interface InitLocalProjectResult {
  projectDir: string;
  configPath: string;
  storagePath: string;
}

const LOCAL_STORAGE_DIRNAME = "data";

/**
 * Initializes a new project in the given directory.
 * Creates evalstudio.config.json with version 2 and data/ storage dir.
 */
export function initLocalProject(
  dir: string,
  name: string,
): InitLocalProjectResult {
  const projectDir = dir;
  const configPath = join(projectDir, CONFIG_FILENAME);
  const storagePath = join(projectDir, LOCAL_STORAGE_DIRNAME);

  const existing = [configPath, storagePath].filter(existsSync);
  if (existing.length > 0) {
    throw new Error(`Already initialized: ${existing.join(", ")} already exists`);
  }

  mkdirSync(projectDir, { recursive: true });

  const config: ProjectConfig = { version: 2, name };
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");

  mkdirSync(storagePath, { recursive: true });

  return { projectDir, configPath, storagePath };
}
