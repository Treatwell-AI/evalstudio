import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { basename, dirname, join } from "node:path";

export const CONFIG_FILENAME = "evalstudio.config.json";
const LOCAL_STORAGE_DIRNAME = "data";
const PROJECTS_DIRNAME = "projects";

export const ERR_NO_PROJECT = "ERR_NO_PROJECT";

/**
 * Immutable context for a specific project.
 * Created once per CLI command or API request, passed explicitly.
 */
export interface ProjectContext {
  /** UUID */
  id: string;
  /** Display name */
  name: string;
  /** Absolute path to projects/{uuid}/data/ */
  dataDir: string;
  /** Absolute path to workspace root */
  workspaceDir: string;
}

export interface ProjectInfo {
  id: string;
  name: string;
}

interface WorkspaceConfigFile {
  version: number;
  name: string;
  projects: ProjectInfo[];
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Error helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function ensureDir(dir: string): string {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function discoverWorkspaceDir(startDir: string): string | null {
  let current = startDir;
  while (true) {
    const configPath = join(current, CONFIG_FILENAME);
    if (existsSync(configPath)) {
      // Verify it's a workspace config (has projects array)
      try {
        const data = JSON.parse(readFileSync(configPath, "utf-8"));
        if (Array.isArray(data.projects)) {
          return current;
        }
      } catch {
        // Not a valid workspace config, keep searching
      }
    }
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function discoverProjectDir(startDir: string): { workspaceDir: string; projectId: string } | null {
  // Walk up looking for a directory whose parent is "projects" and grandparent
  // contains evalstudio.config.json with this project ID registered.
  let current = startDir;
  while (true) {
    const parentDir = dirname(current);
    const grandparentDir = dirname(parentDir);
    const dirName = basename(current);

    if (basename(parentDir) === PROJECTS_DIRNAME && existsSync(join(grandparentDir, CONFIG_FILENAME))) {
      try {
        const data = JSON.parse(readFileSync(join(grandparentDir, CONFIG_FILENAME), "utf-8"));
        if (Array.isArray(data.projects) && data.projects.some((p: ProjectInfo) => p.id === dirName)) {
          return { workspaceDir: grandparentDir, projectId: dirName };
        }
      } catch {
        // Not a valid config, keep searching
      }
    }

    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function readWorkspaceConfigFile(workspaceDir: string): WorkspaceConfigFile {
  const configPath = join(workspaceDir, CONFIG_FILENAME);
  return JSON.parse(readFileSync(configPath, "utf-8")) as WorkspaceConfigFile;
}

function getProjectDir(workspaceDir: string, projectId: string): string {
  return join(workspaceDir, PROJECTS_DIRNAME, projectId);
}

// ---------------------------------------------------------------------------
// Public API — Workspace-level operations
// ---------------------------------------------------------------------------

/**
 * Find the workspace root by walking up from startDir (or cwd).
 * Returns the absolute path to the directory containing evalstudio.config.json (v3).
 */
export function resolveWorkspace(startDir?: string): string {
  const start = startDir ?? process.env.EVALSTUDIO_PROJECT_DIR ?? process.cwd();
  const dir = discoverWorkspaceDir(start);
  if (dir) return dir;

  // Also try: maybe startDir is inside a project dir
  const project = discoverProjectDir(start);
  if (project) return project.workspaceDir;

  throw noProjectError();
}

/**
 * List all projects in a workspace.
 */
export function listProjects(workspaceDir: string): ProjectInfo[] {
  const config = readWorkspaceConfigFile(workspaceDir);
  return config.projects.map((p) => ({ id: p.id, name: p.name }));
}

/**
 * Create a new project in the workspace.
 * Generates a UUID, creates the directory structure, and updates the workspace config.
 */
export function createProject(workspaceDir: string, name: string): ProjectContext {
  const id = randomUUID();
  const projectDir = getProjectDir(workspaceDir, id);
  const dataDir = join(projectDir, LOCAL_STORAGE_DIRNAME);

  // Create directories
  ensureDir(projectDir);
  ensureDir(dataDir);

  // Update workspace config
  const wsConfig = readWorkspaceConfigFile(workspaceDir);
  wsConfig.projects.push({ id, name });
  writeFileSync(
    join(workspaceDir, CONFIG_FILENAME),
    JSON.stringify(wsConfig, null, 2) + "\n",
  );

  return { id, name, dataDir, workspaceDir };
}

/**
 * Delete a project from the workspace.
 * Removes the project directory and its entry from the workspace config.
 */
export function deleteProject(workspaceDir: string, projectId: string): void {
  const wsConfig = readWorkspaceConfigFile(workspaceDir);
  const index = wsConfig.projects.findIndex((p) => p.id === projectId);
  if (index === -1) {
    throw new Error(`Project "${projectId}" not found`);
  }

  // Remove project directory
  const projectDir = getProjectDir(workspaceDir, projectId);
  if (existsSync(projectDir)) {
    rmSync(projectDir, { recursive: true });
  }

  // Update workspace config
  wsConfig.projects.splice(index, 1);
  writeFileSync(
    join(workspaceDir, CONFIG_FILENAME),
    JSON.stringify(wsConfig, null, 2) + "\n",
  );
}

// ---------------------------------------------------------------------------
// Public API — Project resolution
// ---------------------------------------------------------------------------

/**
 * Resolve a ProjectContext from an explicit project ID.
 * Used by the API server (project ID from URL param).
 */
export function resolveProject(workspaceDir: string, projectId: string): ProjectContext {
  const wsConfig = readWorkspaceConfigFile(workspaceDir);

  // Support UUID prefix matching (first 8+ chars)
  const matches = wsConfig.projects.filter((p) =>
    p.id === projectId || p.id.startsWith(projectId),
  );

  if (matches.length === 0) {
    throw new Error(`Project "${projectId}" not found`);
  }
  if (matches.length > 1) {
    throw new Error(`Ambiguous project ID prefix "${projectId}" — matches ${matches.length} projects`);
  }

  const project = matches[0];
  const projectDir = getProjectDir(workspaceDir, project.id);
  const dataDir = join(projectDir, LOCAL_STORAGE_DIRNAME);

  // Ensure data dir exists
  ensureDir(dataDir);

  return {
    id: project.id,
    name: project.name,
    dataDir,
    workspaceDir,
  };
}

/**
 * Resolve a ProjectContext from the current working directory.
 * Used by the CLI (user is cd'd into a project dir or workspace root).
 *
 * Resolution order:
 * 1. If inside projects/{uuid}/ (registered in workspace config), use that project
 * 2. If at workspace root and there's exactly one project, use it
 * 3. Otherwise, throw
 */
export function resolveProjectFromCwd(startDir?: string): ProjectContext {
  const start = startDir ?? process.env.EVALSTUDIO_PROJECT_DIR ?? process.cwd();

  // Try: inside a project directory
  const project = discoverProjectDir(start);
  if (project) {
    return resolveProject(project.workspaceDir, project.projectId);
  }

  // Try: at workspace root with exactly one project
  const workspaceDir = discoverWorkspaceDir(start);
  if (workspaceDir) {
    const wsConfig = readWorkspaceConfigFile(workspaceDir);
    if (wsConfig.projects.length === 1) {
      return resolveProject(workspaceDir, wsConfig.projects[0].id);
    }
    if (wsConfig.projects.length > 1) {
      throw new Error(
        "Multiple projects found. Use 'evalstudio use <project-id>' to switch to a project directory.",
      );
    }
  }

  throw noProjectError();
}

// ---------------------------------------------------------------------------
// Workspace initialization
// ---------------------------------------------------------------------------

export interface InitWorkspaceResult {
  workspaceDir: string;
  workspaceConfigPath: string;
  project: ProjectContext;
}

/**
 * Initializes a new workspace in the given directory.
 * Creates evalstudio.config.json (v3) and the first project.
 */
export function initWorkspace(dir: string, workspaceName: string, projectName: string): InitWorkspaceResult {
  const workspaceDir = dir;
  const workspaceConfigPath = join(workspaceDir, CONFIG_FILENAME);

  if (existsSync(workspaceConfigPath)) {
    throw new Error(`Already initialized: ${workspaceConfigPath} already exists`);
  }

  ensureDir(workspaceDir);

  // Generate first project
  const projectId = randomUUID();
  const projectDir = getProjectDir(workspaceDir, projectId);
  const dataDir = join(projectDir, LOCAL_STORAGE_DIRNAME);

  ensureDir(projectDir);
  ensureDir(dataDir);

  // Write workspace config (includes project registry)
  const wsConfig: WorkspaceConfigFile = {
    version: 3,
    name: workspaceName,
    projects: [{ id: projectId, name: projectName }],
  };
  writeFileSync(workspaceConfigPath, JSON.stringify(wsConfig, null, 2) + "\n");

  const project: ProjectContext = {
    id: projectId,
    name: projectName,
    dataDir,
    workspaceDir,
  };

  return { workspaceDir, workspaceConfigPath, project };
}

// ---------------------------------------------------------------------------
// Legacy compatibility — kept for backward compat during migration
// ---------------------------------------------------------------------------

let legacyStorageDir: string | null = null;
let legacyConfigDir: string | null = null;

/**
 * @deprecated Use resolveProjectFromCwd() instead.
 * Override the storage directory (useful for tests).
 */
export function setStorageDir(dir: string | null): void {
  legacyStorageDir = dir;
}

/**
 * @deprecated Use resolveProjectFromCwd() instead.
 * Override the config directory (useful for tests).
 */
export function setConfigDir(dir: string | null): void {
  legacyConfigDir = dir;
}

/**
 * @deprecated Use resolveProjectFromCwd() instead.
 * Reset all storage/config overrides.
 */
export function resetStorageDir(): void {
  legacyStorageDir = null;
  legacyConfigDir = null;
}

/**
 * @deprecated Use ctx.dataDir from ProjectContext instead.
 * Returns the data/ storage directory.
 */
export function getStorageDir(): string {
  if (legacyStorageDir !== null) return ensureDir(legacyStorageDir);
  const ctx = resolveProjectFromCwd();
  return ensureDir(ctx.dataDir);
}

/**
 * @deprecated Use resolveWorkspace() instead.
 * Returns the path to the config file.
 */
export function getConfigPath(): string {
  if (legacyConfigDir !== null) {
    return join(legacyConfigDir, CONFIG_FILENAME);
  }
  // For legacy callers, try to find workspace config
  const workspaceDir = resolveWorkspace();
  return join(workspaceDir, CONFIG_FILENAME);
}
