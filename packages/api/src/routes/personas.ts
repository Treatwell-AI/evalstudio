import type { FastifyInstance } from "fastify";
import {
  createPersona,
  deletePersona,
  getPersona,
  listPersonas,
  updatePersona,
} from "@evalstudio/core";

interface CreatePersonaBody {
  projectId: string;
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

interface PersonaQuerystring {
  projectId?: string;
}

export async function personasRoute(fastify: FastifyInstance) {
  fastify.get<{ Querystring: PersonaQuerystring }>(
    "/personas",
    async (request) => {
      return listPersonas(request.query.projectId);
    }
  );

  fastify.get<{ Params: PersonaParams }>(
    "/personas/:id",
    async (request, reply) => {
      const persona = getPersona(request.params.id);

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
      const { projectId, name, description, systemPrompt } = request.body;

      if (!projectId) {
        reply.code(400);
        return { error: "Project ID is required" };
      }

      if (!name) {
        reply.code(400);
        return { error: "Name is required" };
      }

      try {
        const persona = createPersona({
          projectId,
          name,
          description,
          systemPrompt,
        });
        reply.code(201);
        return persona;
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

  fastify.put<{ Params: PersonaParams; Body: UpdatePersonaBody }>(
    "/personas/:id",
    async (request, reply) => {
      const { name, description, systemPrompt } = request.body;

      try {
        const persona = updatePersona(request.params.id, {
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
      const deleted = deletePersona(request.params.id);

      if (!deleted) {
        reply.code(404);
        return { error: "Persona not found" };
      }

      reply.code(204);
      return;
    }
  );
}
