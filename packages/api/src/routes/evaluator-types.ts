import type { FastifyInstance } from "fastify";

export async function evaluatorTypesRoute(fastify: FastifyInstance) {
  fastify.get("/evaluator-types", async () => {
    return fastify.evaluatorRegistry.list();
  });
}
