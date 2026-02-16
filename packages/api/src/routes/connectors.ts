import type { FastifyInstance } from "fastify";
import {
  createConnector,
  deleteConnector,
  getConnector,
  getConnectorTypes,
  invokeConnector,
  listConnectors,
  testConnector,
  updateConnector,
  type ConnectorConfig,
  type ConnectorType,
  type Message,
} from "@evalstudio/core";

interface CreateConnectorBody {
  name: string;
  type: ConnectorType;
  baseUrl: string;
  headers?: Record<string, string>;
  config?: ConnectorConfig;
}

interface UpdateConnectorBody {
  name?: string;
  type?: ConnectorType;
  baseUrl?: string;
  headers?: Record<string, string>;
  config?: ConnectorConfig;
}

interface ConnectorParams {
  id: string;
}

export async function connectorsRoute(fastify: FastifyInstance) {
  fastify.get("/connectors", async () => {
    return listConnectors();
  });

  fastify.get("/connectors/types", async () => {
    return getConnectorTypes();
  });

  fastify.get<{ Params: ConnectorParams }>(
    "/connectors/:id",
    async (request, reply) => {
      const connector = getConnector(request.params.id);

      if (!connector) {
        reply.code(404);
        return { error: "Connector not found" };
      }

      return connector;
    }
  );

  fastify.post<{ Body: CreateConnectorBody }>(
    "/connectors",
    async (request, reply) => {
      const { name, type, baseUrl, headers, config } = request.body;

      if (!name) {
        reply.code(400);
        return { error: "Name is required" };
      }

      if (!type) {
        reply.code(400);
        return { error: "Type is required" };
      }

      if (!baseUrl) {
        reply.code(400);
        return { error: "Base URL is required" };
      }

      try {
        const connector = createConnector({
          name,
          type,
          baseUrl,
          headers,
          config,
        });
        reply.code(201);
        return connector;
      } catch (error) {
        if (error instanceof Error) {
          reply.code(409);
          return { error: error.message };
        }
        throw error;
      }
    }
  );

  fastify.put<{ Params: ConnectorParams; Body: UpdateConnectorBody }>(
    "/connectors/:id",
    async (request, reply) => {
      const { name, type, baseUrl, headers, config } = request.body;

      try {
        const connector = updateConnector(request.params.id, {
          name,
          type,
          baseUrl,
          headers,
          config,
        });

        if (!connector) {
          reply.code(404);
          return { error: "Connector not found" };
        }

        return connector;
      } catch (error) {
        if (error instanceof Error) {
          reply.code(409);
          return { error: error.message };
        }
        throw error;
      }
    }
  );

  fastify.delete<{ Params: ConnectorParams }>(
    "/connectors/:id",
    async (request, reply) => {
      const deleted = deleteConnector(request.params.id);

      if (!deleted) {
        reply.code(404);
        return { error: "Connector not found" };
      }

      reply.code(204);
      return;
    }
  );

  fastify.post<{ Params: ConnectorParams }>(
    "/connectors/:id/test",
    async (request) => {
      const result = await testConnector(request.params.id);
      return result;
    }
  );

  interface InvokeConnectorBody {
    messages: Message[];
  }

  fastify.post<{ Params: ConnectorParams; Body: InvokeConnectorBody }>(
    "/connectors/:id/invoke",
    async (request, reply) => {
      const { messages } = request.body;

      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        reply.code(400);
        return { error: "Messages array is required" };
      }

      const result = await invokeConnector(request.params.id, { messages });
      return result;
    }
  );
}
