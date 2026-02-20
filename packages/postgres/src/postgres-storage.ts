import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import type {
  StorageProvider,
  ProjectInfo,
  ProjectContext,
  ProjectEntry,
  UpdateProjectConfigInput,
  LLMSettings,
} from "@evalstudio/core";
import { createPostgresRepository } from "./postgres-repository.js";

/**
 * PostgreSQL-backed StorageProvider implementation.
 *
 * Projects are stored in a `projects` table (not in the config file).
 * Entity data goes into per-entity tables with a `project_id` scope.
 */
export function createPostgresStorageProvider(pool: Pool): StorageProvider {
  return {
    createRepository<T>(entity: string, projectId: string) {
      return createPostgresRepository<T>(pool, entity, projectId);
    },

    async listProjects(): Promise<ProjectInfo[]> {
      const { rows } = await pool.query(
        "SELECT id, name FROM projects ORDER BY created_at",
      );
      return rows.map((r: { id: string; name: string }) => ({
        id: r.id,
        name: r.name,
      }));
    },

    async createProject(name: string): Promise<ProjectContext> {
      const id = randomUUID();
      await pool.query(
        "INSERT INTO projects (id, name) VALUES ($1, $2)",
        [id, name],
      );
      return { id, name, workspaceDir: "" };
    },

    async deleteProject(projectId: string): Promise<void> {
      const result = await pool.query(
        "DELETE FROM projects WHERE id = $1",
        [projectId],
      );
      if (result.rowCount === 0) {
        throw new Error(`Project "${projectId}" not found`);
      }
      // CASCADE handles entity cleanup
    },

    async getProjectEntry(projectId: string): Promise<ProjectEntry> {
      const { rows } = await pool.query(
        "SELECT id, name, llm_settings, max_concurrency FROM projects WHERE id = $1",
        [projectId],
      );
      if (rows.length === 0) {
        throw new Error(`Project "${projectId}" not found`);
      }
      const row = rows[0] as {
        id: string;
        name: string;
        llm_settings: LLMSettings | null;
        max_concurrency: number | null;
      };
      return {
        id: row.id,
        name: row.name,
        llmSettings: row.llm_settings ?? undefined,
        maxConcurrency: row.max_concurrency ?? undefined,
      };
    },

    async updateProjectEntry(
      projectId: string,
      input: UpdateProjectConfigInput,
    ): Promise<ProjectEntry> {
      // Fetch current entry for merging
      const current = await this.getProjectEntry(projectId);

      // Handle llmSettings
      let newLLMSettings: LLMSettings | undefined;
      if (input.llmSettings === null) {
        newLLMSettings = undefined;
      } else if (input.llmSettings !== undefined) {
        // Validate provider
        if (!input.llmSettings.provider) {
          throw new Error("LLM provider type is required");
        }
        // apiKey fallback to existing
        if (!input.llmSettings.apiKey) {
          const existingKey = current.llmSettings?.apiKey;
          if (!existingKey) {
            throw new Error("LLM provider API key is required");
          }
          newLLMSettings = { ...input.llmSettings, apiKey: existingKey };
        } else {
          newLLMSettings = input.llmSettings;
        }
      } else {
        newLLMSettings = current.llmSettings;
      }

      // Handle maxConcurrency
      let newMaxConcurrency: number | undefined;
      if (input.maxConcurrency === null) {
        newMaxConcurrency = undefined;
      } else if (input.maxConcurrency !== undefined) {
        if (input.maxConcurrency < 1) {
          throw new Error("maxConcurrency must be at least 1");
        }
        newMaxConcurrency = input.maxConcurrency;
      } else {
        newMaxConcurrency = current.maxConcurrency;
      }

      const newName = input.name ?? current.name;

      await pool.query(
        `UPDATE projects
         SET name = $1, llm_settings = $2, max_concurrency = $3, updated_at = now()
         WHERE id = $4`,
        [
          newName,
          newLLMSettings ? JSON.stringify(newLLMSettings) : null,
          newMaxConcurrency ?? null,
          projectId,
        ],
      );

      return {
        id: projectId,
        name: newName,
        llmSettings: newLLMSettings,
        maxConcurrency: newMaxConcurrency,
      };
    },
  };
}
