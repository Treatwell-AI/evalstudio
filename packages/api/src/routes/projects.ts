import type { FastifyInstance } from "fastify";
import {
  getProjectConfig,
  updateProjectConfig,
  type ProjectLLMSettings,
} from "@evalstudio/core";

interface UpdateProjectConfigBody {
  name?: string;
  llmSettings?: ProjectLLMSettings | null;
}

export async function projectsRoute(fastify: FastifyInstance) {
  fastify.get("/project", async () => {
    return getProjectConfig();
  });

  fastify.put<{ Body: UpdateProjectConfigBody }>(
    "/project",
    async (request, reply) => {
      const { name, llmSettings } = request.body;

      try {
        const config = updateProjectConfig({
          name,
          llmSettings,
        });

        return config;
      } catch (error) {
        if (error instanceof Error) {
          reply.code(400);
          return { error: error.message };
        }
        throw error;
      }
    }
  );
}
