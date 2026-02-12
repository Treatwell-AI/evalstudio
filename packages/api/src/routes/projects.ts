import type { FastifyInstance } from "fastify";
import {
  createProject,
  deleteProject,
  getProject,
  listProjects,
  updateProject,
  type ProjectLLMSettings,
} from "@evalstudio/core";

interface CreateProjectBody {
  name: string;
  description?: string;
  llmSettings?: ProjectLLMSettings;
}

interface UpdateProjectBody {
  name?: string;
  description?: string;
  llmSettings?: ProjectLLMSettings | null;
}

interface ProjectParams {
  id: string;
}

export async function projectsRoute(fastify: FastifyInstance) {
  fastify.get("/projects", async () => {
    return listProjects();
  });

  fastify.get<{ Params: ProjectParams }>(
    "/projects/:id",
    async (request, reply) => {
      const project = getProject(request.params.id);

      if (!project) {
        reply.code(404);
        return { error: "Project not found" };
      }

      return project;
    }
  );

  fastify.post<{ Body: CreateProjectBody }>(
    "/projects",
    async (request, reply) => {
      const { name, description, llmSettings } = request.body;

      if (!name) {
        reply.code(400);
        return { error: "Name is required" };
      }

      try {
        const project = createProject({ name, description, llmSettings });
        reply.code(201);
        return project;
      } catch (error) {
        if (error instanceof Error) {
          reply.code(409);
          return { error: error.message };
        }
        throw error;
      }
    }
  );

  fastify.put<{ Params: ProjectParams; Body: UpdateProjectBody }>(
    "/projects/:id",
    async (request, reply) => {
      const { name, description, llmSettings } = request.body;

      try {
        const project = updateProject(request.params.id, {
          name,
          description,
          llmSettings,
        });

        if (!project) {
          reply.code(404);
          return { error: "Project not found" };
        }

        return project;
      } catch (error) {
        if (error instanceof Error) {
          reply.code(400);
          return { error: error.message };
        }
        throw error;
      }
    }
  );

  fastify.delete<{ Params: ProjectParams }>(
    "/projects/:id",
    async (request, reply) => {
      const deleted = deleteProject(request.params.id);

      if (!deleted) {
        reply.code(404);
        return { error: "Project not found" };
      }

      reply.code(204);
      return;
    }
  );
}
