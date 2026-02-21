import type { Repository } from "./repository.js";
import type { ProjectContext, ProjectInfo } from "./project-resolver.js";
import type { ProjectEntry, UpdateProjectConfigInput } from "./project.js";

/**
 * Blob store for images, scoped to a project.
 *
 * Each image is stored with a UUID-based ID (e.g. "a1b2c3.png").
 * The extension encodes the mime type. Callers store the returned ID
 * in their own entities to reference the image.
 */
export interface ImageStore {
  /** Save an image blob. Returns the generated image ID (e.g. "uuid.ext"). */
  save(imageBase64: string, originalFilename?: string): Promise<string>;
  /** Get an image by ID */
  get(id: string): Promise<{ buffer: Buffer; mimeType: string } | null>;
  /** Delete an image by ID */
  delete(id: string): Promise<boolean>;
}

/**
 * Storage backend abstraction.
 *
 * Core defines this interface; concrete implementations live in:
 * - FilesystemStorageProvider (this package, filesystem-storage.ts)
 * - PostgresStorageProvider  (@evalstudio/postgres package)
 *
 * Entity modules receive Repository<T> instances created by the provider —
 * they never know or care which backend is behind them.
 */
export interface StorageProvider {
  /** Create a repository for an entity type, scoped to a project */
  createRepository<T>(entity: string, projectId: string): Repository<T>;

  /** Create an image store scoped to a project */
  createImageStore(projectId: string): ImageStore;

  /** Project registry operations */
  listProjects(): Promise<ProjectInfo[]>;
  createProject(name: string): Promise<ProjectContext>;
  deleteProject(projectId: string): Promise<void>;
  getProjectEntry(projectId: string): Promise<ProjectEntry>;
  updateProjectEntry(projectId: string, input: UpdateProjectConfigInput): Promise<ProjectEntry>;
}
