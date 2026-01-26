const API_BASE = "/api";

/**
 * LLM settings for a specific use-case (evaluation or persona generation)
 */
export interface LLMUseCaseSettings {
  providerId: string;
  model?: string;
}

/**
 * Project-level LLM configuration for different use-cases
 */
export interface ProjectLLMSettings {
  /** LLM settings for evaluation/judging conversations */
  evaluation?: LLMUseCaseSettings;
  /** LLM settings for persona response generation */
  persona?: LLMUseCaseSettings;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  /** Default LLM settings for the project */
  llmSettings?: ProjectLLMSettings;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  llmSettings?: ProjectLLMSettings;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  /** Set to null to clear LLM settings */
  llmSettings?: ProjectLLMSettings | null;
}

export interface Status {
  name: string;
  version: string;
  status: "ok" | "error";
  timestamp: string;
  node: string;
}

export interface Persona {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  systemPrompt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePersonaInput {
  projectId: string;
  name: string;
  description?: string;
  systemPrompt?: string;
}

export interface UpdatePersonaInput {
  name?: string;
  description?: string;
  systemPrompt?: string;
}

export type FailureCriteriaMode = "every_turn" | "on_max_messages";

export interface Scenario {
  id: string;
  projectId: string;
  name: string;
  instructions?: string;
  messages?: Message[];
  maxMessages?: number;
  successCriteria?: string;
  failureCriteria?: string;
  failureCriteriaMode?: FailureCriteriaMode;
  /** IDs of personas associated with this scenario */
  personaIds?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateScenarioInput {
  projectId: string;
  name: string;
  instructions?: string;
  messages?: Message[];
  maxMessages?: number;
  successCriteria?: string;
  failureCriteria?: string;
  failureCriteriaMode?: FailureCriteriaMode;
  /** IDs of personas associated with this scenario */
  personaIds?: string[];
}

export interface UpdateScenarioInput {
  name?: string;
  instructions?: string;
  messages?: Message[];
  maxMessages?: number;
  successCriteria?: string;
  failureCriteria?: string;
  failureCriteriaMode?: FailureCriteriaMode;
  /** IDs of personas associated with this scenario */
  personaIds?: string[];
}

/**
 * A tool call made by an assistant message.
 */
export interface ToolCall {
  id?: string;
  name: string;
  args: Record<string, unknown>;
  type?: string;
}

/**
 * A content block within a message (for multi-part content).
 */
export interface ContentBlock {
  type: string;
  text?: string;
  [key: string]: unknown;
}

/**
 * A message in OpenAI chat format with optional LangGraph extensions.
 */
export interface Message {
  role: "user" | "assistant" | "system" | "tool";
  content: string | ContentBlock[];
  /** Tool calls made by the assistant */
  tool_calls?: ToolCall[];
  /** Tool call ID (for tool response messages) */
  tool_call_id?: string;
  /** Message name (e.g., tool name for tool messages) */
  name?: string;
  /** Additional metadata from the model/framework */
  additional_kwargs?: Record<string, unknown>;
  /** Response metadata from the model */
  response_metadata?: Record<string, unknown>;
  /** Message ID */
  id?: string;
}

/**
 * Normalizes message content to a string.
 * If content is already a string, returns it as-is.
 * If content is an array of ContentBlocks, extracts and joins text content.
 */
export function getMessageContent(message: Message): string {
  if (typeof message.content === "string") {
    return message.content;
  }
  if (Array.isArray(message.content)) {
    return message.content
      .map((block: ContentBlock) => {
        if (block.type === "text" && block.text) {
          return block.text;
        }
        return `[${block.type}]`;
      })
      .join("\n");
  }
  return "";
}

export interface ScenarioSummary {
  id: string;
  name: string;
  instructions?: string;
  messages?: Message[];
  maxMessages?: number;
  successCriteria?: string;
  failureCriteria?: string;
  failureCriteriaMode?: FailureCriteriaMode;
}

export interface Eval {
  id: string;
  projectId: string;
  /** Display name for the eval */
  name: string;
  /** Input messages for the eval */
  input: Message[];
  /** Required: Scenarios define the test contexts and evaluation criteria */
  scenarioIds: string[];
  /** The connector to use for running this eval (required) */
  connectorId: string;
  createdAt: string;
  updatedAt: string;
}

export interface EvalWithRelations extends Eval {
  /** Scenarios are always populated (required relation) */
  scenarios: ScenarioSummary[];
  connector?: {
    id: string;
    name: string;
    type: string;
    baseUrl: string;
  };
}

export interface CreateEvalInput {
  projectId: string;
  /** Display name for the eval */
  name: string;
  /** Initial input messages */
  input?: Message[];
  /** Required: Scenarios define the test contexts and evaluation criteria */
  scenarioIds: string[];
  /** The connector to use for running this eval (required) */
  connectorId: string;
}

export interface UpdateEvalInput {
  /** Display name for the eval */
  name?: string;
  /** Input messages */
  input?: Message[];
  /** Scenarios define the test contexts and evaluation criteria */
  scenarioIds?: string[];
  /** The connector to use for running this eval */
  connectorId?: string;
}

export type ProviderType = "openai" | "anthropic";

export interface LLMProviderConfig {
  [key: string]: unknown;
}

export interface LLMProvider {
  id: string;
  projectId: string;
  name: string;
  provider: ProviderType;
  apiKey: string;
  config?: LLMProviderConfig;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLLMProviderInput {
  projectId: string;
  name: string;
  provider: ProviderType;
  apiKey: string;
  config?: LLMProviderConfig;
}

export interface UpdateLLMProviderInput {
  name?: string;
  provider?: ProviderType;
  apiKey?: string;
  config?: LLMProviderConfig;
}

export interface DefaultModels {
  openai: string[];
  anthropic: string[];
}

export type ConnectorType = "http" | "langgraph";

export type AuthType = "none" | "api-key" | "bearer" | "basic";

/** Configuration for LangGraph Dev API connectors */
export interface LangGraphConnectorConfig {
  /** The assistant ID to use when invoking the LangGraph agent (required) */
  assistantId: string;
  /** The graph ID to use (optional) */
  graphId?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/** Configuration for generic HTTP/REST API connectors */
export interface HttpConnectorConfig {
  /** HTTP method to use (defaults to POST) */
  method?: "GET" | "POST" | "PUT" | "PATCH";
  /** Additional headers */
  headers?: Record<string, string>;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Path to append to base URL */
  path?: string;
}

/** Union type for connector configurations */
export type ConnectorConfig = LangGraphConnectorConfig | HttpConnectorConfig;

export interface Connector {
  id: string;
  projectId: string;
  name: string;
  type: ConnectorType;
  baseUrl: string;
  authType?: AuthType;
  authValue?: string;
  config?: ConnectorConfig;
  createdAt: string;
  updatedAt: string;
}

export interface CreateConnectorInput {
  projectId: string;
  name: string;
  type: ConnectorType;
  baseUrl: string;
  authType?: AuthType;
  authValue?: string;
  config?: ConnectorConfig;
}

export interface UpdateConnectorInput {
  name?: string;
  type?: ConnectorType;
  baseUrl?: string;
  authType?: AuthType;
  authValue?: string;
  config?: ConnectorConfig;
}

export interface ConnectorTypes {
  http: string;
  langgraph: string;
}

export interface ConnectorTestResult {
  success: boolean;
  latencyMs: number;
  response?: string;
  error?: string;
}

export interface ConnectorInvokeInput {
  messages: Message[];
}

export interface ConnectorInvokeResult {
  success: boolean;
  latencyMs: number;
  messages?: Message[];
  rawResponse?: string;
  error?: string;
}

/**
 * Run status types:
 * - queued: Waiting to be processed
 * - pending: Reserved for future use
 * - running: Currently executing
 * - completed: Finished (check result.success for pass/fail)
 * - error: System error occurred (retryable)
 */
export type RunStatus = "queued" | "pending" | "running" | "completed" | "error";

export interface RunResult {
  success: boolean;
  score?: number;
  reason?: string;
}

export interface RunMetadata {
  latencyMs?: number;
  tokenUsage?: {
    input: number;
    output: number;
  };
  [key: string]: unknown;
}

export interface Run {
  id: string;
  /** Eval ID (optional for playground runs) */
  evalId?: string;
  projectId: string;
  personaId?: string;
  scenarioId: string;
  /** Connector ID (for playground runs without eval) */
  connectorId?: string;
  /** Execution ID - groups runs created together in a single execution */
  executionId?: number;
  status: RunStatus;
  startedAt?: string;
  completedAt?: string;
  messages: Message[];
  output?: Record<string, unknown>;
  result?: RunResult;
  error?: string;
  metadata?: RunMetadata;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRunInput {
  evalId: string;
}

export interface CreatePlaygroundRunInput {
  scenarioId: string;
  connectorId: string;
  personaId?: string;
}

export interface UpdateRunInput {
  status?: RunStatus;
  startedAt?: string;
  completedAt?: string;
  messages?: Message[];
  output?: Record<string, unknown>;
  result?: RunResult;
  error?: string;
  metadata?: RunMetadata;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json();
}

export const api = {
  status: {
    get: async (): Promise<Status> => {
      const response = await fetch(`${API_BASE}/status`);
      return handleResponse(response);
    },
  },

  projects: {
    list: async (): Promise<Project[]> => {
      const response = await fetch(`${API_BASE}/projects`);
      return handleResponse(response);
    },

    get: async (id: string): Promise<Project> => {
      const response = await fetch(`${API_BASE}/projects/${id}`);
      return handleResponse(response);
    },

    create: async (input: CreateProjectInput): Promise<Project> => {
      const response = await fetch(`${API_BASE}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      return handleResponse(response);
    },

    update: async (id: string, input: UpdateProjectInput): Promise<Project> => {
      const response = await fetch(`${API_BASE}/projects/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      return handleResponse(response);
    },

    delete: async (id: string): Promise<void> => {
      const response = await fetch(`${API_BASE}/projects/${id}`, {
        method: "DELETE",
      });
      return handleResponse(response);
    },
  },

  personas: {
    list: async (projectId?: string): Promise<Persona[]> => {
      const url = projectId
        ? `${API_BASE}/personas?projectId=${projectId}`
        : `${API_BASE}/personas`;
      const response = await fetch(url);
      return handleResponse(response);
    },

    get: async (id: string): Promise<Persona> => {
      const response = await fetch(`${API_BASE}/personas/${id}`);
      return handleResponse(response);
    },

    create: async (input: CreatePersonaInput): Promise<Persona> => {
      const response = await fetch(`${API_BASE}/personas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      return handleResponse(response);
    },

    update: async (id: string, input: UpdatePersonaInput): Promise<Persona> => {
      const response = await fetch(`${API_BASE}/personas/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      return handleResponse(response);
    },

    delete: async (id: string): Promise<void> => {
      const response = await fetch(`${API_BASE}/personas/${id}`, {
        method: "DELETE",
      });
      return handleResponse(response);
    },
  },

  scenarios: {
    list: async (projectId?: string): Promise<Scenario[]> => {
      const url = projectId
        ? `${API_BASE}/scenarios?projectId=${projectId}`
        : `${API_BASE}/scenarios`;
      const response = await fetch(url);
      return handleResponse(response);
    },

    get: async (id: string): Promise<Scenario> => {
      const response = await fetch(`${API_BASE}/scenarios/${id}`);
      return handleResponse(response);
    },

    create: async (input: CreateScenarioInput): Promise<Scenario> => {
      const response = await fetch(`${API_BASE}/scenarios`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      return handleResponse(response);
    },

    update: async (id: string, input: UpdateScenarioInput): Promise<Scenario> => {
      const response = await fetch(`${API_BASE}/scenarios/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      return handleResponse(response);
    },

    delete: async (id: string): Promise<void> => {
      const response = await fetch(`${API_BASE}/scenarios/${id}`, {
        method: "DELETE",
      });
      return handleResponse(response);
    },

    getPrompt: async (id: string, personaId?: string): Promise<{ systemPrompt: string; messages: Message[] }> => {
      const url = personaId
        ? `${API_BASE}/scenarios/${id}/prompt?personaId=${personaId}`
        : `${API_BASE}/scenarios/${id}/prompt`;
      const response = await fetch(url);
      return handleResponse(response);
    },
  },

  evals: {
    list: async (projectId?: string): Promise<Eval[]> => {
      const url = projectId
        ? `${API_BASE}/evals?projectId=${projectId}`
        : `${API_BASE}/evals`;
      const response = await fetch(url);
      return handleResponse(response);
    },

    get: async (id: string, expand?: boolean): Promise<Eval | EvalWithRelations> => {
      const url = expand
        ? `${API_BASE}/evals/${id}?expand=true`
        : `${API_BASE}/evals/${id}`;
      const response = await fetch(url);
      return handleResponse(response);
    },

    create: async (input: CreateEvalInput): Promise<Eval> => {
      const response = await fetch(`${API_BASE}/evals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      return handleResponse(response);
    },

    update: async (id: string, input: UpdateEvalInput): Promise<Eval> => {
      const response = await fetch(`${API_BASE}/evals/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      return handleResponse(response);
    },

    delete: async (id: string): Promise<void> => {
      const response = await fetch(`${API_BASE}/evals/${id}`, {
        method: "DELETE",
      });
      return handleResponse(response);
    },
  },

  llmProviders: {
    list: async (projectId?: string): Promise<LLMProvider[]> => {
      const url = projectId
        ? `${API_BASE}/llm-providers?projectId=${projectId}`
        : `${API_BASE}/llm-providers`;
      const response = await fetch(url);
      return handleResponse(response);
    },

    get: async (id: string): Promise<LLMProvider> => {
      const response = await fetch(`${API_BASE}/llm-providers/${id}`);
      return handleResponse(response);
    },

    getModels: async (): Promise<DefaultModels> => {
      const response = await fetch(`${API_BASE}/llm-providers/models`);
      return handleResponse(response);
    },

    getProviderModels: async (providerId: string): Promise<string[]> => {
      const response = await fetch(`${API_BASE}/llm-providers/${providerId}/models`);
      const data = await handleResponse<{ models: string[] }>(response);
      return data.models;
    },

    create: async (input: CreateLLMProviderInput): Promise<LLMProvider> => {
      const response = await fetch(`${API_BASE}/llm-providers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      return handleResponse(response);
    },

    update: async (id: string, input: UpdateLLMProviderInput): Promise<LLMProvider> => {
      const response = await fetch(`${API_BASE}/llm-providers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      return handleResponse(response);
    },

    delete: async (id: string): Promise<void> => {
      const response = await fetch(`${API_BASE}/llm-providers/${id}`, {
        method: "DELETE",
      });
      return handleResponse(response);
    },
  },

  connectors: {
    list: async (projectId?: string): Promise<Connector[]> => {
      const url = projectId
        ? `${API_BASE}/connectors?projectId=${projectId}`
        : `${API_BASE}/connectors`;
      const response = await fetch(url);
      return handleResponse(response);
    },

    get: async (id: string): Promise<Connector> => {
      const response = await fetch(`${API_BASE}/connectors/${id}`);
      return handleResponse(response);
    },

    getTypes: async (): Promise<ConnectorTypes> => {
      const response = await fetch(`${API_BASE}/connectors/types`);
      return handleResponse(response);
    },

    create: async (input: CreateConnectorInput): Promise<Connector> => {
      const response = await fetch(`${API_BASE}/connectors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      return handleResponse(response);
    },

    update: async (id: string, input: UpdateConnectorInput): Promise<Connector> => {
      const response = await fetch(`${API_BASE}/connectors/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      return handleResponse(response);
    },

    delete: async (id: string): Promise<void> => {
      const response = await fetch(`${API_BASE}/connectors/${id}`, {
        method: "DELETE",
      });
      return handleResponse(response);
    },

    test: async (id: string): Promise<ConnectorTestResult> => {
      const response = await fetch(`${API_BASE}/connectors/${id}/test`, {
        method: "POST",
      });
      return handleResponse(response);
    },

    invoke: async (id: string, input: ConnectorInvokeInput): Promise<ConnectorInvokeResult> => {
      const response = await fetch(`${API_BASE}/connectors/${id}/invoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      return handleResponse(response);
    },
  },

  runs: {
    list: async (evalId?: string, projectId?: string, scenarioId?: string, personaId?: string): Promise<Run[]> => {
      const params = new URLSearchParams();
      if (evalId) params.set("evalId", evalId);
      if (projectId) params.set("projectId", projectId);
      if (scenarioId) params.set("scenarioId", scenarioId);
      if (personaId) params.set("personaId", personaId);
      const query = params.toString();
      const url = query ? `${API_BASE}/runs?${query}` : `${API_BASE}/runs`;
      const response = await fetch(url);
      return handleResponse(response);
    },

    get: async (id: string): Promise<Run> => {
      const response = await fetch(`${API_BASE}/runs/${id}`);
      return handleResponse(response);
    },

    create: async (input: CreateRunInput): Promise<Run[]> => {
      const response = await fetch(`${API_BASE}/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      return handleResponse(response);
    },

    createPlayground: async (input: CreatePlaygroundRunInput): Promise<Run> => {
      const response = await fetch(`${API_BASE}/runs/playground`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      return handleResponse(response);
    },

    update: async (id: string, input: UpdateRunInput): Promise<Run> => {
      const response = await fetch(`${API_BASE}/runs/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      return handleResponse(response);
    },

    delete: async (id: string): Promise<void> => {
      const response = await fetch(`${API_BASE}/runs/${id}`, {
        method: "DELETE",
      });
      return handleResponse(response);
    },

    retry: async (id: string, options?: { clearMessages?: boolean }): Promise<Run> => {
      const response = await fetch(`${API_BASE}/runs/${id}/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(options || {}),
      });
      return handleResponse(response);
    },
  },
};
