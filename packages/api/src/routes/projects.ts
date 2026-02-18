import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import {
  listProjects,
  createProject,
  resolveProject,
  deleteProject,
  getProjectConfig,
  updateProjectConfig,
  readWorkspaceConfig,
  updateWorkspaceConfig,
  redactApiKey,
  type LLMSettings,
} from "@evalstudio/core";

interface ProjectsPluginOptions extends FastifyPluginOptions {
  workspaceDir: string;
}

interface ProjectIdParams {
  projectId: string;
}

interface CreateProjectBody {
  name: string;
}

interface UpdateProjectConfigBody {
  name?: string;
  llmSettings?: LLMSettings | null;
  maxConcurrency?: number | null;
}

interface UpdateWorkspaceConfigBody {
  name?: string;
  llmSettings?: LLMSettings | null;
  maxConcurrency?: number | null;
}

/** Strip apiKey from llmSettings in a config object for safe API responses */
function redactConfig<T extends { llmSettings?: { apiKey: string } }>(config: T): T {
  if (!config.llmSettings?.apiKey) return config;
  return {
    ...config,
    llmSettings: {
      ...config.llmSettings,
      apiKey: redactApiKey(config.llmSettings.apiKey),
    },
  };
}

export async function projectsRoute(fastify: FastifyInstance, opts: ProjectsPluginOptions) {
  const { workspaceDir } = opts;

  // --- Workspace-level endpoints ---

  // GET /api/projects — List all projects
  fastify.get("/projects", async () => {
    return listProjects(workspaceDir);
  });

  // POST /api/projects — Create a new project
  fastify.post<{ Body: CreateProjectBody }>(
    "/projects",
    async (request, reply) => {
      const { name } = request.body;

      if (!name) {
        reply.code(400);
        return { error: "Name is required" };
      }

      const ctx = createProject(workspaceDir, name);
      reply.code(201);
      return { id: ctx.id, name: ctx.name };
    }
  );

  // GET /api/workspace — Get workspace config
  fastify.get("/workspace", async () => {
    return redactConfig(readWorkspaceConfig(workspaceDir));
  });

  // PUT /api/workspace — Update workspace config (defaults)
  fastify.put<{ Body: UpdateWorkspaceConfigBody }>(
    "/workspace",
    async (request, reply) => {
      const { name, llmSettings, maxConcurrency } = request.body;

      try {
        const config = updateWorkspaceConfig(workspaceDir, {
          name,
          llmSettings,
          maxConcurrency,
        });
        return redactConfig(config);
      } catch (error) {
        if (error instanceof Error) {
          reply.code(400);
          return { error: error.message };
        }
        throw error;
      }
    }
  );

  // --- Project-level endpoints (under /api/projects/:projectId) ---

  // GET /api/projects/:projectId/config — Get effective project config
  fastify.get<{ Params: ProjectIdParams }>(
    "/projects/:projectId/config",
    async (request, reply) => {
      try {
        const ctx = resolveProject(workspaceDir, request.params.projectId);
        return redactConfig(getProjectConfig(ctx));
      } catch (error) {
        if (error instanceof Error) {
          reply.code(404);
          return { error: error.message };
        }
        throw error;
      }
    }
  );

  // PUT /api/projects/:projectId/config — Update per-project config
  fastify.put<{ Params: ProjectIdParams; Body: UpdateProjectConfigBody }>(
    "/projects/:projectId/config",
    async (request, reply) => {
      const { name, llmSettings, maxConcurrency } = request.body;

      try {
        const ctx = resolveProject(workspaceDir, request.params.projectId);
        const config = updateProjectConfig(ctx, {
          name,
          llmSettings,
          maxConcurrency,
        });
        return redactConfig(config);
      } catch (error) {
        if (error instanceof Error) {
          reply.code(400);
          return { error: error.message };
        }
        throw error;
      }
    }
  );

  // DELETE /api/projects/:projectId — Delete a project
  fastify.delete<{ Params: ProjectIdParams }>(
    "/projects/:projectId",
    async (request, reply) => {
      try {
        deleteProject(workspaceDir, request.params.projectId);
        reply.code(204);
        return;
      } catch (error) {
        if (error instanceof Error) {
          reply.code(404);
          return { error: error.message };
        }
        throw error;
      }
    }
  );
}
