import type { FastifyInstance } from "fastify";

interface UploadImageBody {
  /** Base64-encoded image data (with or without data URL prefix) */
  imageBase64: string;
  /** Image role (e.g. "persona-avatar", "persona-avatar-styleguide") */
  role: string;
  /** Original filename for extension detection */
  filename?: string;
}

interface ImageIdParams {
  id: string;
}

interface ListByRoleQuery {
  role: string;
}

export async function imagesRoute(fastify: FastifyInstance) {
  // ── Upload a new image ────────────────────────────────────────────

  fastify.post<{ Body: UploadImageBody }>(
    "/images",
    async (request, reply) => {
      const { imageBase64, role, filename } = request.body;

      if (!imageBase64) {
        reply.code(400);
        return { error: "imageBase64 is required" };
      }
      if (!role) {
        reply.code(400);
        return { error: "role is required" };
      }

      const imageStore = fastify.storage.createImageStore(request.projectCtx!.id);
      const id = await imageStore.save(imageBase64, role, filename);

      reply.code(201);
      return { id };
    },
  );

  // ── List images by role ─────────────────────────────────────────

  fastify.get<{ Querystring: ListByRoleQuery }>(
    "/images",
    async (request, reply) => {
      const { role } = request.query;

      if (!role) {
        reply.code(400);
        return { error: "role query parameter is required" };
      }

      const imageStore = fastify.storage.createImageStore(request.projectCtx!.id);
      const ids = await imageStore.listByRole(role);

      return { ids };
    },
  );

  // ── Serve an image by ID ──────────────────────────────────────────

  fastify.get<{ Params: ImageIdParams }>(
    "/images/:id",
    async (request, reply) => {
      const imageStore = fastify.storage.createImageStore(request.projectCtx!.id);
      const result = await imageStore.get(request.params.id);

      if (!result) {
        reply.code(404);
        return { error: "Image not found" };
      }

      reply.type(result.mimeType);
      reply.header("Cache-Control", "public, max-age=3600");
      return reply.send(result.buffer);
    },
  );

  // ── Delete an image by ID ─────────────────────────────────────────

  fastify.delete<{ Params: ImageIdParams }>(
    "/images/:id",
    async (request, reply) => {
      const imageStore = fastify.storage.createImageStore(request.projectCtx!.id);
      const deleted = await imageStore.delete(request.params.id);

      if (!deleted) {
        reply.code(404);
        return { error: "Image not found" };
      }

      reply.code(204);
      return;
    },
  );
}
