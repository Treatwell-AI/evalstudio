import type { FastifyInstance } from "fastify";
import {
  getDefaultModels,
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

  // Get model groups for a specific provider type
  fastify.get<{ Params: ProviderTypeParams }>(
    "/llm-providers/:providerType/models",
    async (request, reply) => {
      const { providerType } = request.params;

      if (!validProviderTypes.includes(providerType as ProviderType)) {
        reply.code(400);
        return { error: `Invalid provider type "${providerType}". Must be one of: ${validProviderTypes.join(", ")}` };
      }

      const models = getDefaultModels();
      return { groups: models[providerType as ProviderType] };
    }
  );
}
