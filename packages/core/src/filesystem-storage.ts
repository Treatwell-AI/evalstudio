import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join, extname } from "node:path";
import { randomUUID } from "node:crypto";
import { createJsonRepository } from "./repository.js";
import {
  listProjects as listProjectsFromResolver,
  createProject as createProjectFromResolver,
  deleteProject as deleteProjectFromResolver,
} from "./project-resolver.js";
import {
  readWorkspaceConfig,
  writeWorkspaceConfig,
  type ProjectEntry,
  type UpdateProjectConfigInput,
  type LLMSettings,
} from "./project.js";
import type { StorageProvider, ImageStore } from "./storage-provider.js";

// ── Filesystem image helpers ─────────────────────────────────────────

function mimeFromExt(ext: string): string {
  const map: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
  };
  return map[ext.toLowerCase()] ?? "application/octet-stream";
}

/**
 * Filesystem image store. Images live under {dataDir}/images/{role}/.
 * Each image is named {uuid}.{ext}.
 */
function createFilesystemImageStore(dataDir: string): ImageStore {
  const imagesDir = join(dataDir, "images");

  function roleDir(role: string): string {
    return join(imagesDir, role);
  }

  /** Search all role subdirectories for an image by ID */
  function findImagePath(id: string): string | null {
    if (!existsSync(imagesDir)) return null;
    for (const role of readdirSync(imagesDir)) {
      const filepath = join(imagesDir, role, id);
      if (existsSync(filepath)) return filepath;
    }
    // Fallback: check flat images dir for pre-migration images
    const flatPath = join(imagesDir, id);
    if (existsSync(flatPath)) return flatPath;
    return null;
  }

  return {
    async save(imageBase64: string, role: string, originalFilename?: string): Promise<string> {
      const dir = roleDir(role);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      const ext = originalFilename ? extname(originalFilename) || ".png" : ".png";
      const id = `${randomUUID()}${ext}`;
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
      writeFileSync(join(dir, id), Buffer.from(base64Data, "base64"));
      return id;
    },

    async get(id: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
      const filepath = findImagePath(id);
      if (!filepath) return null;
      return { buffer: readFileSync(filepath), mimeType: mimeFromExt(extname(filepath)) };
    },

    async delete(id: string): Promise<boolean> {
      const filepath = findImagePath(id);
      if (!filepath) return false;
      unlinkSync(filepath);
      return true;
    },

    async listByRole(role: string): Promise<string[]> {
      const dir = roleDir(role);
      if (!existsSync(dir)) return [];
      return readdirSync(dir).filter((f) => !f.startsWith("."));
    },
  };
}

/**
 * Filesystem-based StorageProvider.
 *
 * Delegates entity storage to JSON files via createJsonRepository,
 * and project CRUD to the existing project-resolver functions.
 *
 * This is the default storage backend — no extra dependencies required.
 */
export function createFilesystemStorage(workspaceDir: string): StorageProvider {
  return {
    createRepository<T>(entity: string, projectId: string) {
      const dataDir = join(workspaceDir, "projects", projectId, "data");
      return createJsonRepository<T>(`${entity}.json`, dataDir);
    },

    createImageStore(projectId: string): ImageStore {
      const dataDir = join(workspaceDir, "projects", projectId, "data");
      return createFilesystemImageStore(dataDir);
    },

    async listProjects() {
      return listProjectsFromResolver(workspaceDir);
    },

    async createProject(name) {
      return createProjectFromResolver(workspaceDir, name);
    },

    async deleteProject(projectId) {
      deleteProjectFromResolver(workspaceDir, projectId);
    },

    async getProjectEntry(projectId) {
      const wsConfig = readWorkspaceConfig(workspaceDir);
      const entry = wsConfig.projects.find((p) => p.id === projectId);
      if (!entry) {
        throw new Error(`Project "${projectId}" not found in workspace config`);
      }
      return entry;
    },

    async updateProjectEntry(projectId, input) {
      const wsConfig = readWorkspaceConfig(workspaceDir);
      const entry = wsConfig.projects.find((p) => p.id === projectId);
      if (!entry) {
        throw new Error(`Project "${projectId}" not found in workspace config`);
      }

      if (input.llmSettings) {
        if (!input.llmSettings.provider) {
          throw new Error("LLM provider type is required");
        }
        if (!input.llmSettings.apiKey) {
          const existingKey = entry.llmSettings?.apiKey || wsConfig.llmSettings?.apiKey;
          if (!existingKey) {
            throw new Error("LLM provider API key is required");
          }
          input = { ...input, llmSettings: { ...input.llmSettings, apiKey: existingKey } };
        }
      }

      let newLLMSettings: LLMSettings | undefined;
      if (input.llmSettings === null) {
        newLLMSettings = undefined;
      } else if (input.llmSettings !== undefined) {
        newLLMSettings = input.llmSettings;
      } else {
        newLLMSettings = entry.llmSettings;
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
        newMaxConcurrency = entry.maxConcurrency;
      }

      const newName = input.name ?? entry.name;
      entry.name = newName;
      entry.llmSettings = newLLMSettings;
      entry.maxConcurrency = newMaxConcurrency;

      writeWorkspaceConfig(workspaceDir, wsConfig);

      return entry;
    },
  };
}
