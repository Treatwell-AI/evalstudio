import type { FastifyInstance } from "fastify";
import {
  getProjectConfig,
  updateProjectConfig,
  type LLMProviderSettings,
  type ProjectLLMSettings,
} from "@evalstudio/core";

interface UpdateProjectConfigBody {
  name?: string;
  llmProvider?: LLMProviderSettings | null;
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
      const { name, llmProvider, llmSettings, maxConcurrency } = request.body;

      try {
        const config = updateProjectConfig({
          name,
          llmProvider,
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
