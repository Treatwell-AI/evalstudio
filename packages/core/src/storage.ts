import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export const CONFIG_FILENAME = "evalstudio.config.json";
const LOCAL_STORAGE_DIRNAME = ".evalstudio";

let storageDir: string | null = null;
let discoveredDir: string | null | undefined = undefined;

function discoverLocalStorageDir(startDir: string): string | null {
  let current = startDir;
  while (true) {
    if (existsSync(join(current, CONFIG_FILENAME))) {
      return join(current, LOCAL_STORAGE_DIRNAME);
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

export function getStorageDir(): string {
  if (storageDir !== null) return ensureDir(storageDir);
  if (process.env.EVALSTUDIO_STORAGE_DIR) return ensureDir(process.env.EVALSTUDIO_STORAGE_DIR);
  if (discoveredDir === undefined) {
    discoveredDir = discoverLocalStorageDir(process.cwd());
  }
  if (discoveredDir !== null) return ensureDir(discoveredDir);
  return ensureDir(join(homedir(), ".evalstudio"));
}

export function setStorageDir(dir: string | null): void {
  storageDir = dir;
}

export function resetStorageDir(): void {
  storageDir = null;
  discoveredDir = undefined;
}

export interface InitLocalProjectResult {
  projectDir: string;
  configPath: string;
  storagePath: string;
}

export function initLocalProject(
  parentDir: string,
  name: string,
): InitLocalProjectResult {
  const projectDir = join(parentDir, name);
  const configPath = join(projectDir, CONFIG_FILENAME);

  if (existsSync(configPath)) {
    throw new Error(`Already initialized: ${configPath} already exists`);
  }

  mkdirSync(projectDir, { recursive: true });
  writeFileSync(configPath, JSON.stringify({ version: 1 }, null, 2) + "\n");

  const storagePath = join(projectDir, LOCAL_STORAGE_DIRNAME);
  mkdirSync(storagePath, { recursive: true });

  return { projectDir, configPath, storagePath };
}
