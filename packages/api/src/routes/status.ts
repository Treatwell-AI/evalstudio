import type { FastifyInstance } from "fastify";
import { getStatus } from "evalstudio";

export async function statusRoute(fastify: FastifyInstance) {
  fastify.get("/status", async () => {
    return getStatus();
  });
}
