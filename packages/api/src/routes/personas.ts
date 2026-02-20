import type { FastifyInstance } from "fastify";
import { createProjectModules } from "@evalstudio/core";

interface CreatePersonaBody {
  name: string;
  description?: string;
  systemPrompt?: string;
}

interface UpdatePersonaBody {
  name?: string;
  description?: string;
  systemPrompt?: string;
}

interface PersonaParams {
  id: string;
}

export async function personasRoute(fastify: FastifyInstance) {
  fastify.get("/personas", async (request) => {
    const { personas } = createProjectModules(fastify.storage, request.projectCtx!.id);
    return await personas.list();
  });

  fastify.get<{ Params: PersonaParams }>(
    "/personas/:id",
    async (request, reply) => {
      const { personas } = createProjectModules(fastify.storage, request.projectCtx!.id);
      const persona = await personas.get(request.params.id);

      if (!persona) {
        reply.code(404);
        return { error: "Persona not found" };
      }

      return persona;
    }
  );

  fastify.post<{ Body: CreatePersonaBody }>(
    "/personas",
    async (request, reply) => {
      const { name, description, systemPrompt } = request.body;

      if (!name) {
        reply.code(400);
        return { error: "Name is required" };
      }

      try {
        const { personas } = createProjectModules(fastify.storage, request.projectCtx!.id);
        const persona = await personas.create({
          name,
          description,
          systemPrompt,
        });
        reply.code(201);
        return persona;
      } catch (error) {
        if (error instanceof Error) {
          reply.code(409);
          return { error: error.message };
        }
        throw error;
      }
    }
  );

  fastify.put<{ Params: PersonaParams; Body: UpdatePersonaBody }>(
    "/personas/:id",
    async (request, reply) => {
      const { name, description, systemPrompt } = request.body;

      try {
        const { personas } = createProjectModules(fastify.storage, request.projectCtx!.id);
        const persona = await personas.update(request.params.id, {
          name,
          description,
          systemPrompt,
        });

        if (!persona) {
          reply.code(404);
          return { error: "Persona not found" };
        }

        return persona;
      } catch (error) {
        if (error instanceof Error) {
          reply.code(409);
          return { error: error.message };
        }
        throw error;
      }
    }
  );

  fastify.delete<{ Params: PersonaParams }>(
    "/personas/:id",
    async (request, reply) => {
      const { personas } = createProjectModules(fastify.storage, request.projectCtx!.id);
      const deleted = await personas.delete(request.params.id);

      if (!deleted) {
        reply.code(404);
        return { error: "Persona not found" };
      }

      reply.code(204);
      return;
    }
  );
}
