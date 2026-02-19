import { join } from "node:path";
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
import type { StorageProvider } from "./storage-provider.js";

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
