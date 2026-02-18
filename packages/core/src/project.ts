import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ProviderType } from "./llm-provider.js";
import { CONFIG_FILENAME, type ProjectContext } from "./project-resolver.js";

/**
 * Model selection per use-case
 */
export interface LLMModelSettings {
  /** Model for evaluation/judging conversations */
  evaluation?: string;
  /** Model for persona response generation */
  persona?: string;
}

/**
 * Unified LLM configuration: provider, credentials, and model selection
 */
export interface LLMSettings {
  provider: ProviderType;
  apiKey: string;
  /** Model selection per use-case */
  models?: LLMModelSettings;
}

/**
 * Effective project configuration (workspace defaults merged with per-project overrides).
 * This is what consumers see — the merged result.
 */
export interface ProjectConfig {
  version: number;
  name: string;
  /** LLM provider configuration and model selection */
  llmSettings?: LLMSettings;
  /** Maximum concurrent run executions (default: 3) */
  maxConcurrency?: number;
}

/**
 * Workspace config stored in evalstudio.config.json at the workspace root.
 * Contains the project registry and workspace-level defaults.
 */
export interface WorkspaceConfig extends ProjectConfig {
  projects: Array<{ id: string; name: string }>;
}

/**
 * Per-project config stored in project.config.json.
 * Sparse — only contains fields that differ from the workspace.
 */
export interface PerProjectConfig {
  name: string;
  llmSettings?: LLMSettings;
  maxConcurrency?: number;
}

// ---------------------------------------------------------------------------
// Workspace config
// ---------------------------------------------------------------------------

/**
 * Reads and parses the workspace config from evalstudio.config.json.
 */
export function readWorkspaceConfig(workspaceDir: string): WorkspaceConfig {
  const configPath = join(workspaceDir, CONFIG_FILENAME);
  const data = readFileSync(configPath, "utf-8");
  return JSON.parse(data) as WorkspaceConfig;
}

/**
 * Writes the workspace config back to evalstudio.config.json.
 */
export function writeWorkspaceConfig(workspaceDir: string, config: WorkspaceConfig): void {
  const configPath = join(workspaceDir, CONFIG_FILENAME);
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
}

export interface UpdateWorkspaceConfigInput {
  name?: string;
  llmSettings?: LLMSettings | null;
  maxConcurrency?: number | null;
}

/**
 * Updates the workspace config (workspace-level defaults, not per-project).
 */
export function updateWorkspaceConfig(
  workspaceDir: string,
  input: UpdateWorkspaceConfigInput,
): WorkspaceConfig {
  const config = readWorkspaceConfig(workspaceDir);

  if (input.llmSettings) {
    if (!input.llmSettings.provider) {
      throw new Error("LLM provider type is required");
    }
    if (!input.llmSettings.apiKey) {
      throw new Error("LLM provider API key is required");
    }
  }

  let newLLMSettings: LLMSettings | undefined;
  if (input.llmSettings === null) {
    newLLMSettings = undefined;
  } else if (input.llmSettings !== undefined) {
    newLLMSettings = input.llmSettings;
  } else {
    newLLMSettings = config.llmSettings;
  }

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

  const updated: WorkspaceConfig = {
    ...config,
    name: input.name ?? config.name,
    llmSettings: newLLMSettings,
    maxConcurrency: newMaxConcurrency,
  };

  writeWorkspaceConfig(workspaceDir, updated);
  return updated;
}

// ---------------------------------------------------------------------------
// Per-project config
// ---------------------------------------------------------------------------

/**
 * Reads the per-project config from project.config.json.
 */
export function readPerProjectConfig(ctx: ProjectContext): PerProjectConfig {
  const data = readFileSync(ctx.configPath, "utf-8");
  return JSON.parse(data) as PerProjectConfig;
}

/**
 * Writes the per-project config to project.config.json.
 */
function writePerProjectConfig(ctx: ProjectContext, config: PerProjectConfig): void {
  writeFileSync(ctx.configPath, JSON.stringify(config, null, 2) + "\n");
}

// ---------------------------------------------------------------------------
// Effective config (merged)
// ---------------------------------------------------------------------------

/**
 * Reads the effective project config: workspace defaults merged with per-project overrides.
 *
 * Merge rules:
 * - Scalar fields: project value wins if present
 * - Objects (llmSettings): project replaces entire object if present
 * - version, projects: workspace-only, not in per-project config
 */
export function getProjectConfig(ctx: ProjectContext): ProjectConfig {
  const wsConfig = readWorkspaceConfig(ctx.workspaceDir);
  const projConfig = readPerProjectConfig(ctx);

  return {
    version: wsConfig.version,
    name: projConfig.name,
    llmSettings: projConfig.llmSettings ?? wsConfig.llmSettings,
    maxConcurrency: projConfig.maxConcurrency ?? wsConfig.maxConcurrency,
  };
}

export interface UpdateProjectConfigInput {
  name?: string;
  /** Set to null to clear (inherit from workspace) */
  llmSettings?: LLMSettings | null;
  /** Set to null to clear (inherit from workspace) */
  maxConcurrency?: number | null;
}

/**
 * Updates the per-project config (writes only to project.config.json).
 * Returns the new effective config (merged with workspace defaults).
 */
export function updateProjectConfig(
  ctx: ProjectContext,
  input: UpdateProjectConfigInput,
): ProjectConfig {
  const projConfig = readPerProjectConfig(ctx);

  if (input.llmSettings) {
    if (!input.llmSettings.provider) {
      throw new Error("LLM provider type is required");
    }
    if (!input.llmSettings.apiKey) {
      throw new Error("LLM provider API key is required");
    }
  }

  // Handle llmSettings
  let newLLMSettings: LLMSettings | undefined;
  if (input.llmSettings === null) {
    newLLMSettings = undefined; // Clear → inherit from workspace
  } else if (input.llmSettings !== undefined) {
    newLLMSettings = input.llmSettings;
  } else {
    newLLMSettings = projConfig.llmSettings;
  }

  // Handle maxConcurrency
  let newMaxConcurrency: number | undefined;
  if (input.maxConcurrency === null) {
    newMaxConcurrency = undefined; // Clear → inherit from workspace
  } else if (input.maxConcurrency !== undefined) {
    if (input.maxConcurrency < 1) {
      throw new Error("maxConcurrency must be at least 1");
    }
    newMaxConcurrency = input.maxConcurrency;
  } else {
    newMaxConcurrency = projConfig.maxConcurrency;
  }

  // Update project name in workspace config registry if changed
  const newName = input.name ?? projConfig.name;
  if (input.name && input.name !== projConfig.name) {
    const wsConfig = readWorkspaceConfig(ctx.workspaceDir);
    const projEntry = wsConfig.projects.find((p) => p.id === ctx.id);
    if (projEntry) {
      projEntry.name = input.name;
      writeWorkspaceConfig(ctx.workspaceDir, wsConfig);
    }
  }

  const updated: PerProjectConfig = {
    name: newName,
    llmSettings: newLLMSettings,
    maxConcurrency: newMaxConcurrency,
  };

  writePerProjectConfig(ctx, updated);

  // Return the effective (merged) config
  return getProjectConfig(ctx);
}
