import type { FastifyInstance } from "fastify";
import {
  createLLMProvider,
  deleteLLMProvider,
  fetchProviderModels,
  getDefaultModels,
  getLLMProvider,
  listLLMProviders,
  updateLLMProvider,
  type LLMProviderConfig,
  type ProviderType,
} from "@evalstudio/core";

interface CreateLLMProviderBody {
  projectId: string;
  name: string;
  provider: ProviderType;
  apiKey: string;
  config?: LLMProviderConfig;
}

interface UpdateLLMProviderBody {
  name?: string;
  provider?: ProviderType;
  apiKey?: string;
  config?: LLMProviderConfig;
}

interface LLMProviderParams {
  id: string;
}

interface LLMProviderQuerystring {
  projectId?: string;
}

export async function llmProvidersRoute(fastify: FastifyInstance) {
  fastify.get<{ Querystring: LLMProviderQuerystring }>(
    "/llm-providers",
    async (request) => {
      return listLLMProviders(request.query.projectId);
    }
  );

  fastify.get("/llm-providers/models", async () => {
    return getDefaultModels();
  });

  // Fetch models dynamically from provider's API
  fastify.get<{ Params: LLMProviderParams }>(
    "/llm-providers/:id/models",
    async (request, reply) => {
      try {
        const models = await fetchProviderModels(request.params.id);
        return { models };
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes("not found")) {
            reply.code(404);
            return { error: error.message };
          }
          reply.code(500);
          return { error: error.message };
        }
        throw error;
      }
    }
  );

  fastify.get<{ Params: LLMProviderParams }>(
    "/llm-providers/:id",
    async (request, reply) => {
      const provider = getLLMProvider(request.params.id);

      if (!provider) {
        reply.code(404);
        return { error: "LLM Provider not found" };
      }

      return provider;
    }
  );

  fastify.post<{ Body: CreateLLMProviderBody }>(
    "/llm-providers",
    async (request, reply) => {
      const { projectId, name, provider, apiKey, config } = request.body;

      if (!projectId) {
        reply.code(400);
        return { error: "Project ID is required" };
      }

      if (!name) {
        reply.code(400);
        return { error: "Name is required" };
      }

      if (!provider) {
        reply.code(400);
        return { error: "Provider is required" };
      }

      if (!apiKey) {
        reply.code(400);
        return { error: "API key is required" };
      }

      try {
        const llmProvider = createLLMProvider({
          projectId,
          name,
          provider,
          apiKey,
          config,
        });
        reply.code(201);
        return llmProvider;
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes("not found")) {
            reply.code(404);
          } else {
            reply.code(409);
          }
          return { error: error.message };
        }
        throw error;
      }
    }
  );

  fastify.put<{ Params: LLMProviderParams; Body: UpdateLLMProviderBody }>(
    "/llm-providers/:id",
    async (request, reply) => {
      const { name, provider, apiKey, config } = request.body;

      try {
        const llmProvider = updateLLMProvider(request.params.id, {
          name,
          provider,
          apiKey,
          config,
        });

        if (!llmProvider) {
          reply.code(404);
          return { error: "LLM Provider not found" };
        }

        return llmProvider;
      } catch (error) {
        if (error instanceof Error) {
          reply.code(409);
          return { error: error.message };
        }
        throw error;
      }
    }
  );

  fastify.delete<{ Params: LLMProviderParams }>(
    "/llm-providers/:id",
    async (request, reply) => {
      const deleted = deleteLLMProvider(request.params.id);

      if (!deleted) {
        reply.code(404);
        return { error: "LLM Provider not found" };
      }

      reply.code(204);
      return;
    }
  );
}
