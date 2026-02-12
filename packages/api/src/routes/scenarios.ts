import type { FastifyInstance } from "fastify";
import {
  buildTestAgentMessages,
  buildTestAgentSystemPrompt,
  createScenario,
  deleteScenario,
  getPersona,
  getScenario,
  listScenarios,
  updateScenario,
  type FailureCriteriaMode,
  type Message,
} from "@evalstudio/core";

interface CreateScenarioBody {
  projectId: string;
  name: string;
  instructions?: string;
  messages?: Message[];
  maxMessages?: number;
  successCriteria?: string;
  failureCriteria?: string;
  failureCriteriaMode?: FailureCriteriaMode;
  personaIds?: string[];
}

interface UpdateScenarioBody {
  name?: string;
  instructions?: string;
  messages?: Message[];
  maxMessages?: number;
  successCriteria?: string;
  failureCriteria?: string;
  failureCriteriaMode?: FailureCriteriaMode;
  personaIds?: string[];
}

interface ScenarioParams {
  id: string;
}

interface ScenarioQuerystring {
  projectId?: string;
}

interface ScenarioPromptQuerystring {
  personaId?: string;
}

export async function scenariosRoute(fastify: FastifyInstance) {
  fastify.get<{ Querystring: ScenarioQuerystring }>(
    "/scenarios",
    async (request) => {
      return listScenarios(request.query.projectId);
    }
  );

  fastify.get<{ Params: ScenarioParams }>(
    "/scenarios/:id",
    async (request, reply) => {
      const scenario = getScenario(request.params.id);

      if (!scenario) {
        reply.code(404);
        return { error: "Scenario not found" };
      }

      return scenario;
    }
  );

  // Get the test agent prompt and messages for a scenario with optional persona
  fastify.get<{ Params: ScenarioParams; Querystring: ScenarioPromptQuerystring }>(
    "/scenarios/:id/prompt",
    async (request, reply) => {
      const scenario = getScenario(request.params.id);

      if (!scenario) {
        reply.code(404);
        return { error: "Scenario not found" };
      }

      // Get persona if provided
      let persona = null;
      if (request.query.personaId) {
        persona = getPersona(request.query.personaId);
        if (!persona) {
          reply.code(404);
          return { error: "Persona not found" };
        }
      }

      const promptInput = {
        persona,
        scenario,
      };

      const systemPrompt = buildTestAgentSystemPrompt(promptInput);
      const messages = buildTestAgentMessages(promptInput);

      return { systemPrompt, messages };
    }
  );

  fastify.post<{ Body: CreateScenarioBody }>(
    "/scenarios",
    async (request, reply) => {
      const { projectId, name, instructions, messages, maxMessages, successCriteria, failureCriteria, failureCriteriaMode, personaIds } = request.body;

      if (!projectId) {
        reply.code(400);
        return { error: "Project ID is required" };
      }

      if (!name) {
        reply.code(400);
        return { error: "Name is required" };
      }

      try {
        const scenario = createScenario({
          projectId,
          name,
          instructions,
          messages,
          maxMessages,
          successCriteria,
          failureCriteria,
          failureCriteriaMode,
          personaIds,
        });
        reply.code(201);
        return scenario;
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

  fastify.put<{ Params: ScenarioParams; Body: UpdateScenarioBody }>(
    "/scenarios/:id",
    async (request, reply) => {
      const { name, instructions, messages, maxMessages, successCriteria, failureCriteria, failureCriteriaMode, personaIds } = request.body;

      try {
        const scenario = updateScenario(request.params.id, {
          name,
          instructions,
          messages,
          maxMessages,
          successCriteria,
          failureCriteria,
          failureCriteriaMode,
          personaIds,
        });

        if (!scenario) {
          reply.code(404);
          return { error: "Scenario not found" };
        }

        return scenario;
      } catch (error) {
        if (error instanceof Error) {
          reply.code(409);
          return { error: error.message };
        }
        throw error;
      }
    }
  );

  fastify.delete<{ Params: ScenarioParams }>(
    "/scenarios/:id",
    async (request, reply) => {
      const deleted = deleteScenario(request.params.id);

      if (!deleted) {
        reply.code(404);
        return { error: "Scenario not found" };
      }

      reply.code(204);
      return;
    }
  );
}
