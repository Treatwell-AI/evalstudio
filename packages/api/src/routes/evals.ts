import type { FastifyInstance } from "fastify";
import {
  createEval,
  deleteEval,
  getEval,
  getEvalWithRelations,
  listEvals,
  updateEval,
  type Message,
} from "evalstudio";

interface CreateEvalBody {
  projectId: string;
  /** Display name for the eval (required) */
  name: string;
  input?: Message[];
  /** Required: Scenarios define the test contexts and evaluation criteria */
  scenarioIds: string[];
  /** The connector to use for running this eval (required) */
  connectorId: string;
}

interface UpdateEvalBody {
  /** Display name for the eval */
  name?: string;
  input?: Message[];
  /** Scenarios define the test contexts and evaluation criteria */
  scenarioIds?: string[];
  /** The connector to use for running this eval */
  connectorId?: string;
}

interface EvalParams {
  id: string;
}

interface EvalQuerystring {
  projectId?: string;
  expand?: string;
}

export async function evalsRoute(fastify: FastifyInstance) {
  fastify.get<{ Querystring: EvalQuerystring }>(
    "/evals",
    async (request) => {
      return listEvals(request.query.projectId);
    }
  );

  fastify.get<{ Params: EvalParams; Querystring: EvalQuerystring }>(
    "/evals/:id",
    async (request, reply) => {
      const expand = request.query.expand === "true";

      const evalItem = expand
        ? getEvalWithRelations(request.params.id)
        : getEval(request.params.id);

      if (!evalItem) {
        reply.code(404);
        return { error: "Eval not found" };
      }

      return evalItem;
    }
  );

  fastify.post<{ Body: CreateEvalBody }>(
    "/evals",
    async (request, reply) => {
      const {
        projectId,
        name,
        input,
        scenarioIds,
        connectorId,
      } = request.body;

      if (!projectId) {
        reply.code(400);
        return { error: "Project ID is required" };
      }

      if (!name) {
        reply.code(400);
        return { error: "Name is required" };
      }

      if (!scenarioIds || scenarioIds.length === 0) {
        reply.code(400);
        return { error: "At least one Scenario ID is required" };
      }

      if (!connectorId) {
        reply.code(400);
        return { error: "Connector ID is required" };
      }

      try {
        const evalItem = createEval({
          projectId,
          name,
          input,
          scenarioIds,
          connectorId,
        });
        reply.code(201);
        return evalItem;
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes("not found")) {
            reply.code(404);
          } else if (error.message.includes("does not belong")) {
            reply.code(400);
          } else {
            reply.code(409);
          }
          return { error: error.message };
        }
        throw error;
      }
    }
  );

  fastify.put<{ Params: EvalParams; Body: UpdateEvalBody }>(
    "/evals/:id",
    async (request, reply) => {
      const {
        name,
        input,
        scenarioIds,
        connectorId,
      } = request.body;

      try {
        const evalItem = updateEval(request.params.id, {
          name,
          input,
          scenarioIds,
          connectorId,
        });

        if (!evalItem) {
          reply.code(404);
          return { error: "Eval not found" };
        }

        return evalItem;
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes("not found")) {
            reply.code(404);
          } else if (error.message.includes("does not belong")) {
            reply.code(400);
          } else {
            reply.code(409);
          }
          return { error: error.message };
        }
        throw error;
      }
    }
  );

  fastify.delete<{ Params: EvalParams }>(
    "/evals/:id",
    async (request, reply) => {
      const deleted = deleteEval(request.params.id);

      if (!deleted) {
        reply.code(404);
        return { error: "Eval not found" };
      }

      reply.code(204);
      return;
    }
  );
}
