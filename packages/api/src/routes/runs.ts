import type { FastifyInstance } from "fastify";
import {
  createPlaygroundRun,
  createRuns,
  deleteRun,
  getRun,
  listRuns,
  listRunsByEval,
  listRunsByScenario,
  listRunsByPersona,
  retryRun,
  updateRun,
  type RunStatus,
  type RunResult,
  type RunMetadata,
  type Message,
} from "evalstudio";

interface CreateRunBody {
  evalId: string;
}

interface CreatePlaygroundRunBody {
  scenarioId: string;
  connectorId: string;
  personaId?: string;
}

interface UpdateRunBody {
  status?: RunStatus;
  startedAt?: string;
  completedAt?: string;
  messages?: Message[];
  output?: Record<string, unknown>;
  result?: RunResult;
  error?: string;
  metadata?: RunMetadata;
}

interface RunParams {
  id: string;
}

interface RunQuerystring {
  evalId?: string;
  projectId?: string;
  scenarioId?: string;
  personaId?: string;
}

export async function runsRoute(fastify: FastifyInstance) {
  fastify.get<{ Querystring: RunQuerystring }>("/runs", async (request) => {
    const { evalId, projectId, scenarioId, personaId } = request.query;

    if (evalId) {
      return listRunsByEval(evalId);
    }

    if (scenarioId) {
      return listRunsByScenario(scenarioId);
    }

    if (personaId) {
      return listRunsByPersona(personaId);
    }

    return listRuns(undefined, projectId);
  });

  fastify.get<{ Params: RunParams }>("/runs/:id", async (request, reply) => {
    const run = getRun(request.params.id);

    if (!run) {
      reply.code(404);
      return { error: "Run not found" };
    }

    return run;
  });

  fastify.post<{ Body: CreateRunBody }>("/runs", async (request, reply) => {
    const { evalId } = request.body;

    if (!evalId) {
      reply.code(400);
      return { error: "Eval ID is required" };
    }

    try {
      const runs = createRuns({ evalId });
      reply.code(201);
      return runs;
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("not found")) {
          reply.code(404);
        } else {
          reply.code(400);
        }
        return { error: error.message };
      }
      throw error;
    }
  });

  // Create a playground run (without eval)
  fastify.post<{ Body: CreatePlaygroundRunBody }>(
    "/runs/playground",
    async (request, reply) => {
      const { scenarioId, connectorId, personaId } = request.body;

      if (!scenarioId) {
        reply.code(400);
        return { error: "Scenario ID is required" };
      }

      if (!connectorId) {
        reply.code(400);
        return { error: "Connector ID is required" };
      }

      try {
        const run = createPlaygroundRun({
          scenarioId,
          connectorId,
          personaId,
        });
        reply.code(201);
        return run;
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes("not found")) {
            reply.code(404);
          } else {
            reply.code(400);
          }
          return { error: error.message };
        }
        throw error;
      }
    }
  );

  fastify.put<{ Params: RunParams; Body: UpdateRunBody }>(
    "/runs/:id",
    async (request, reply) => {
      const {
        status,
        startedAt,
        completedAt,
        messages,
        output,
        result,
        error,
        metadata,
      } = request.body;

      const run = updateRun(request.params.id, {
        status,
        startedAt,
        completedAt,
        messages,
        output,
        result,
        error,
        metadata,
      });

      if (!run) {
        reply.code(404);
        return { error: "Run not found" };
      }

      return run;
    }
  );

  // Retry a failed run
  fastify.post<{ Params: RunParams }>(
    "/runs/:id/retry",
    async (request, reply) => {
      try {
        const run = retryRun(request.params.id);

        if (!run) {
          reply.code(404);
          return { error: "Run not found" };
        }

        return run;
      } catch (error) {
        if (error instanceof Error) {
          reply.code(400);
          return { error: error.message };
        }
        throw error;
      }
    }
  );

  fastify.delete<{ Params: RunParams }>(
    "/runs/:id",
    async (request, reply) => {
      const deleted = deleteRun(request.params.id);

      if (!deleted) {
        reply.code(404);
        return { error: "Run not found" };
      }

      reply.code(204);
      return;
    }
  );
}
