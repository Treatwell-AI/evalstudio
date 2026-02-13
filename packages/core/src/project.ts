import { getLLMProvider } from "./llm-provider.js";
import {
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

  const updated: ProjectConfig = {
    ...config,
    name: input.name ?? config.name,
    llmSettings: newLLMSettings,
  };

  writeProjectConfig(updated);
  return updated;
}
