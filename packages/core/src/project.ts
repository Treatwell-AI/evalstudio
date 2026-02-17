import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getLLMProvider } from "./llm-provider.js";
import { CONFIG_FILENAME, getConfigPath } from "./project-resolver.js";

/**
 * LLM settings for a specific use-case (evaluation or persona generation)
 */
export interface LLMUseCaseSettings {
  providerId: string;
  model?: string;
}

/**
 * Project-level LLM configuration for different use-cases
 */
export interface ProjectLLMSettings {
  /** LLM settings for evaluation/judging conversations */
  evaluation?: LLMUseCaseSettings;
  /** LLM settings for persona response generation */
  persona?: LLMUseCaseSettings;
}

/**
 * Project configuration stored in evalstudio.config.json
 */
export interface ProjectConfig {
  version: number;
  name: string;
  llmSettings?: ProjectLLMSettings;
  /** Maximum concurrent run executions (default: 3) */
  maxConcurrency?: number;
}

/**
 * Reads and parses the project config from evalstudio.config.json.
 */
export function readProjectConfig(): ProjectConfig {
  const configPath = getConfigPath();
  const data = readFileSync(configPath, "utf-8");
  return JSON.parse(data) as ProjectConfig;
}

/**
 * Writes the project config back to evalstudio.config.json.
 */
export function writeProjectConfig(config: ProjectConfig): void {
  const configPath = getConfigPath();
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
}

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
}

/**
 * Initializes a new project in the given directory.
 * Creates evalstudio.config.json with version 2.
 * Storage directory (data/) is created lazily on first write.
 */
export function initLocalProject(
  dir: string,
  name: string,
): InitLocalProjectResult {
  const projectDir = dir;
  const configPath = join(projectDir, CONFIG_FILENAME);

  if (existsSync(configPath)) {
    throw new Error(`Already initialized: ${configPath} already exists`);
  }

  mkdirSync(projectDir, { recursive: true });

  const config: ProjectConfig = { version: 2, name };
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");

  return { projectDir, configPath };
}
