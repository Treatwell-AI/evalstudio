import type { Repository } from "./repository.js";
import type { ProjectContext, ProjectInfo } from "./project-resolver.js";
import type { ProjectEntry, UpdateProjectConfigInput } from "./project.js";

/**
 * Storage backend abstraction.
 *
 * Core defines this interface; concrete implementations live in:
 * - FilesystemStorageProvider (this package, filesystem-storage.ts)
 * - PostgresStorageProvider  (@evalstudio/postgres package, Phase 2)
 *
 * Entity modules receive Repository<T> instances created by the provider —
 * they never know or care which backend is behind them.
 */
export interface StorageProvider {
  /** Create a repository for an entity type, scoped to a project */
  createRepository<T>(entity: string, projectId: string): Repository<T>;

  /** Project registry operations */
  listProjects(): Promise<ProjectInfo[]>;
  createProject(name: string): Promise<ProjectContext>;
  deleteProject(projectId: string): Promise<void>;
  getProjectEntry(projectId: string): Promise<ProjectEntry>;
  updateProjectEntry(projectId: string, input: UpdateProjectConfigInput): Promise<ProjectEntry>;
}
