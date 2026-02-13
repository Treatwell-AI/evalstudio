import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const CONFIG_FILENAME = "evalstudio.config.json";
const LOCAL_STORAGE_DIRNAME = "data";

export const ERR_NO_PROJECT = "ERR_NO_PROJECT";

let storageDir: string | null = null;
let configDir: string | null = null;
let discoveredDir: string | null | undefined = undefined;

function noProjectError(): Error {
  const err = new Error([
    "No EvalStudio project found.",
    "",
    "To fix this, either:",
    "  1. Run 'npx @evalstudio/cli init' to create a new project here",
    "  2. cd into an existing project directory",
    "  3. Set EVALSTUDIO_PROJECT_DIR to point to an existing project",
  ].join("\n"));
  (err as NodeJS.ErrnoException).code = ERR_NO_PROJECT;
  return err;
}

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
}

function discoverProjectDir(startDir: string): string | null {
  let current = startDir;
  while (true) {
    if (existsSync(join(current, CONFIG_FILENAME))) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function ensureDir(dir: string): string {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Returns the path to the nearest evalstudio.config.json.
 * Walks up from cwd (or configDir override) to find it.
 * Throws if not found.
 */
export function getConfigPath(): string {
  if (configDir !== null) {
    const path = join(configDir, CONFIG_FILENAME);
    if (existsSync(path)) return path;
    throw noProjectError();
  }

  if (process.env.EVALSTUDIO_PROJECT_DIR) {
    const path = join(process.env.EVALSTUDIO_PROJECT_DIR, CONFIG_FILENAME);
    if (existsSync(path)) return path;
    throw noProjectError();
  }

  const projectDir = discoverProjectDir(process.cwd());
  if (projectDir) {
    return join(projectDir, CONFIG_FILENAME);
  }

  throw noProjectError();
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

/**
 * Returns the data/ storage directory for the current project.
 * Throws if no project is found (no fallback to ~/data/).
 */
export function getStorageDir(): string {
  if (storageDir !== null) return ensureDir(storageDir);
  if (process.env.EVALSTUDIO_PROJECT_DIR) return ensureDir(join(process.env.EVALSTUDIO_PROJECT_DIR, LOCAL_STORAGE_DIRNAME));

  if (discoveredDir === undefined) {
    const projectDir = discoverProjectDir(process.cwd());
    discoveredDir = projectDir ? join(projectDir, LOCAL_STORAGE_DIRNAME) : null;
  }

  if (discoveredDir !== null) return ensureDir(discoveredDir);

  throw noProjectError();
}

/**
 * Override the storage directory (useful for tests).
 */
export function setStorageDir(dir: string | null): void {
  storageDir = dir;
}

/**
 * Override the config directory (useful for tests).
 * When set, getConfigPath() looks for evalstudio.config.json in this directory.
 */
export function setConfigDir(dir: string | null): void {
  configDir = dir;
}

/**
 * Reset all storage/config overrides.
 */
export function resetStorageDir(): void {
  storageDir = null;
  configDir = null;
  discoveredDir = undefined;
}

export interface InitLocalProjectResult {
  projectDir: string;
  configPath: string;
  storagePath: string;
}

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
