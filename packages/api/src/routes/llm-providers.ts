import type { FastifyInstance } from "fastify";
import {
  fetchProviderModels,
  getDefaultModels,
  getLLMProviderFromConfig,
  type ProviderType,
} from "@evalstudio/core";

interface ProviderTypeParams {
  providerType: string;
}

const validProviderTypes: ProviderType[] = ["openai", "anthropic"];

export async function llmProvidersRoute(fastify: FastifyInstance) {
  // Get default models for all provider types
  fastify.get("/llm-providers/models", async () => {
    return getDefaultModels();
  });

  // Fetch models dynamically from the configured provider's API
  fastify.get<{ Params: ProviderTypeParams }>(
    "/llm-providers/:providerType/models",
    async (request, reply) => {
      const { providerType } = request.params;

      if (!validProviderTypes.includes(providerType as ProviderType)) {
        reply.code(400);
        return { error: `Invalid provider type "${providerType}". Must be one of: ${validProviderTypes.join(", ")}` };
      }

      try {
        const provider = getLLMProviderFromConfig();
        const models = await fetchProviderModels(
          providerType as ProviderType,
          provider.apiKey,
        );
        return { models };
      } catch (error) {
        if (error instanceof Error) {
          reply.code(500);
          return { error: error.message };
        }
        throw error;
      }
    }
  );
}
