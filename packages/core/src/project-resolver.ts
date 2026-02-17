import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

export const CONFIG_FILENAME = "evalstudio.config.json";
const LOCAL_STORAGE_DIRNAME = "data";

export const ERR_NO_PROJECT = "ERR_NO_PROJECT";

let storageDir: string | null = null;
let configDir: string | null = null;
let discoveredDir: string | undefined = undefined;

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
 * Resolves the project directory from env var or filesystem discovery.
 * Throws if no project is found.
 */
function resolveProjectDir(): string {
  if (process.env.EVALSTUDIO_PROJECT_DIR) {
    const dir = process.env.EVALSTUDIO_PROJECT_DIR;
    if (existsSync(join(dir, CONFIG_FILENAME))) return dir;
    throw noProjectError();
  }

  const dir = discoverProjectDir(process.cwd());
  if (dir) return dir;

  throw noProjectError();
}

/**
 * Returns the path to the nearest evalstudio.config.json.
 * Walks up from cwd (or configDir override) to find it.
 * Throws if not found.
 */
export function getConfigPath(): string {
  const dir = configDir ?? resolveProjectDir();
  const path = join(dir, CONFIG_FILENAME);
  if (!existsSync(path)) throw noProjectError();
  return path;
}

/**
 * Returns the data/ storage directory for the current project.
 * Throws if no project is found (no fallback to ~/data/).
 */
export function getStorageDir(): string {
  if (storageDir !== null) return ensureDir(storageDir);

  if (discoveredDir === undefined) {
    discoveredDir = join(resolveProjectDir(), LOCAL_STORAGE_DIRNAME);
  }

  return ensureDir(discoveredDir);
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
