import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import type { Pool } from "pg";
import type {
  StorageProvider,
  ImageStore,
  ProjectInfo,
  ProjectContext,
  ProjectEntry,
  UpdateProjectConfigInput,
  LLMSettings,
} from "@evalstudio/core";
import { createPostgresRepository } from "./postgres-repository.js";

// ── Postgres image helpers ───────────────────────────────────────────

function mimeFromExt(ext: string): string {
  const map: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
  };
  return map[ext.toLowerCase()] ?? "image/png";
}

/**
 * PostgreSQL image store. Each image is a BYTEA row keyed by a UUID-based ID.
 */
function createPostgresImageStore(pool: Pool, projectId: string): ImageStore {
  return {
    async save(imageBase64: string, originalFilename?: string): Promise<string> {
      const ext = originalFilename ? extname(originalFilename) || ".png" : ".png";
      const id = `${randomUUID()}${ext}`;
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      const mime = mimeFromExt(ext);

      await pool.query(
        "INSERT INTO project_images (project_id, id, mime_type, data) VALUES ($1, $2, $3, $4)",
        [projectId, id, mime, buffer],
      );
      return id;
    },

    async get(id: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
      const { rows } = await pool.query<{ data: Buffer; mime_type: string }>(
        "SELECT data, mime_type FROM project_images WHERE id = $1",
        [id],
      );
      if (rows.length === 0) return null;
      return { buffer: Buffer.from(rows[0].data), mimeType: rows[0].mime_type };
    },

    async delete(id: string): Promise<boolean> {
      const result = await pool.query(
        "DELETE FROM project_images WHERE id = $1",
        [id],
      );
      return (result.rowCount ?? 0) > 0;
    },
  };
}

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

    createImageStore(projectId: string): ImageStore {
      return createPostgresImageStore(pool, projectId);
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
        "SELECT id, name, llm_settings, max_concurrency, style_reference_image_ids FROM projects WHERE id = $1",
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
        style_reference_image_ids: string[] | null;
      };
      return {
        id: row.id,
        name: row.name,
        llmSettings: row.llm_settings ?? undefined,
        maxConcurrency: row.max_concurrency ?? undefined,
        styleReferenceImageIds: row.style_reference_image_ids ?? undefined,
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

      // Handle styleReferenceImageIds
      let newStyleReferenceImageIds: string[] | undefined;
      if (input.styleReferenceImageIds === null) {
        newStyleReferenceImageIds = undefined;
      } else if (input.styleReferenceImageIds !== undefined) {
        newStyleReferenceImageIds = input.styleReferenceImageIds;
      } else {
        newStyleReferenceImageIds = current.styleReferenceImageIds;
      }

      const newName = input.name ?? current.name;

      await pool.query(
        `UPDATE projects
         SET name = $1, llm_settings = $2, max_concurrency = $3, style_reference_image_ids = $4, updated_at = now()
         WHERE id = $5`,
        [
          newName,
          newLLMSettings ? JSON.stringify(newLLMSettings) : null,
          newMaxConcurrency ?? null,
          newStyleReferenceImageIds ?? null,
          projectId,
        ],
      );

      return {
        id: projectId,
        name: newName,
        llmSettings: newLLMSettings,
        maxConcurrency: newMaxConcurrency,
        styleReferenceImageIds: newStyleReferenceImageIds,
      };
    },
  };
}
