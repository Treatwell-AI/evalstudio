import type { FastifyInstance } from "fastify";
import {
  getProjectConfig,
  updateProjectConfig,
  type ProjectLLMSettings,
} from "@evalstudio/core";

interface UpdateProjectConfigBody {
  name?: string;
  llmSettings?: ProjectLLMSettings | null;
  maxConcurrency?: number | null;
}

export async function projectsRoute(fastify: FastifyInstance) {
  fastify.get("/project", async () => {
    return getProjectConfig();
  });

  fastify.put<{ Body: UpdateProjectConfigBody }>(
    "/project",
    async (request, reply) => {
      const { name, llmSettings, maxConcurrency } = request.body;

      try {
        const config = updateProjectConfig({
          name,
          llmSettings,
          maxConcurrency,
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
