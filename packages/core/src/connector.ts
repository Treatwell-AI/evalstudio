import { randomUUID } from "node:crypto";
import type { Repository } from "./repository.js";
import type { Message } from "./types.js";

export type ConnectorType = "http" | "langgraph";

export interface LangGraphConnectorConfig {
  assistantId: string;
  configurable?: Record<string, unknown>;
}

export interface HttpConnectorConfig {
  method?: "GET" | "POST" | "PUT" | "PATCH";
  path?: string;
}

export type ConnectorConfig = LangGraphConnectorConfig | HttpConnectorConfig;

export interface Connector {
  id: string;
  name: string;
  type: ConnectorType;
  baseUrl: string;
  headers?: Record<string, string>;
  config?: ConnectorConfig;
  createdAt: string;
  updatedAt: string;
}

export interface CreateConnectorInput {
  name: string;
  type: ConnectorType;
  baseUrl: string;
  headers?: Record<string, string>;
  config?: ConnectorConfig;
}

export interface UpdateConnectorInput {
  name?: string;
  type?: ConnectorType;
  baseUrl?: string;
  headers?: Record<string, string>;
  config?: ConnectorConfig;
}

export interface ConnectorTestResult {
  success: boolean;
  latencyMs: number;
  response?: string;
  error?: string;
}

export interface ConnectorInvokeInput {
  messages: Message[];
  runId?: string;
  threadMessageCount?: number;
}

export interface ConnectorInvokeResult {
  success: boolean;
  latencyMs: number;
  messages?: Message[];
  rawResponse?: string;
  error?: string;
}

/**
 * Returns the supported connector types with their descriptions
 */
export function getConnectorTypes(): Record<ConnectorType, string> {
  return {
    http: "Generic HTTP/REST API connector",
    langgraph: "LangGraph Dev API connector for langgraph-backed agents",
  };
}

// ============================================================================
// Connector Strategy Pattern (module-level, no project context needed)
// ============================================================================

interface ConnectorRequestConfig {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

interface ConnectorStrategy {
  buildTestRequest(connector: Connector): ConnectorRequestConfig;
  buildInvokeRequest(connector: Connector, input: ConnectorInvokeInput): ConnectorRequestConfig;
  parseTestResponse(responseText: string): string;
  parseInvokeResponse(responseText: string, inputMessageCount: number): Message[];
}

function buildRequestHeaders(connector: Connector): Record<string, string> {
  return {
    "Content-Type": "application/json",
    ...connector.headers,
  };
}

async function withTiming<T>(
  fn: () => Promise<T>
): Promise<{ result: T; latencyMs: number }> {
  const startTime = Date.now();
  const result = await fn();
  return { result, latencyMs: Date.now() - startTime };
}

const langGraphStrategy: ConnectorStrategy = {
  buildTestRequest(connector: Connector): ConnectorRequestConfig {
    return {
      url: `${connector.baseUrl}/info`,
      method: "GET",
      headers: buildRequestHeaders(connector),
    };
  },

  buildInvokeRequest(connector: Connector, input: ConnectorInvokeInput): ConnectorRequestConfig {
    const lgConfig = connector.config as LangGraphConnectorConfig | undefined;
    const assistantId = lgConfig?.assistantId || "default";

    const url = input.runId
      ? `${connector.baseUrl}/threads/${input.runId}/runs/wait`
      : `${connector.baseUrl}/runs/wait`;

    const messagesToSend = input.threadMessageCount !== undefined && input.threadMessageCount > 0
      ? input.messages.slice(input.threadMessageCount)
      : input.messages;

    return {
      url,
      method: "POST",
      headers: buildRequestHeaders(connector),
      body: JSON.stringify({
        assistant_id: assistantId,
        input: { messages: messagesToSend },
        multitask_strategy: "enqueue",
        if_not_exists: "create",
        ...(lgConfig?.configurable && {
          config: { configurable: lgConfig.configurable },
        }),
      }),
    };
  },

  parseTestResponse(responseText: string): string {
    try {
      const data = JSON.parse(responseText);
      if (data.messages && Array.isArray(data.messages)) {
        const lastMessage = data.messages[data.messages.length - 1];
        if (lastMessage?.content) {
          return typeof lastMessage.content === "string"
            ? lastMessage.content
            : JSON.stringify(lastMessage.content);
        }
      }
    } catch {
      // Keep original
    }
    return responseText;
  },

  parseInvokeResponse(responseText: string, inputMessageCount: number): Message[] {
    try {
      const data = JSON.parse(responseText);
      if (data.messages && Array.isArray(data.messages)) {
        const newMessages = data.messages.slice(inputMessageCount);
        return newMessages.map((msg: Record<string, unknown>) => {
          let role: Message["role"] = "assistant";
          if (msg.type === "human" || msg.role === "user") role = "user";
          else if (msg.type === "tool" || msg.role === "tool") role = "tool";
          else if (msg.type === "system" || msg.role === "system") role = "system";

          const message: Message = { role, content: (msg.content as string) ?? "" };

          if (Array.isArray(msg.tool_calls)) message.tool_calls = msg.tool_calls as Message["tool_calls"];
          if (typeof msg.tool_call_id === "string") message.tool_call_id = msg.tool_call_id;
          if (typeof msg.name === "string") message.name = msg.name;
          if (msg.additional_kwargs && typeof msg.additional_kwargs === "object")
            message.additional_kwargs = msg.additional_kwargs as Record<string, unknown>;
          if (msg.response_metadata && typeof msg.response_metadata === "object")
            message.response_metadata = msg.response_metadata as Record<string, unknown>;
          if (typeof msg.id === "string") message.id = msg.id;

          return message;
        });
      }
    } catch {
      // Parsing failed
    }
    return [];
  },
};

const httpStrategy: ConnectorStrategy = {
  buildTestRequest(connector: Connector): ConnectorRequestConfig {
    return {
      url: connector.baseUrl,
      method: "POST",
      headers: buildRequestHeaders(connector),
      body: JSON.stringify({
        message: "hello",
        messages: [{ role: "user", content: "hello" }],
      }),
    };
  },

  buildInvokeRequest(connector: Connector, input: ConnectorInvokeInput): ConnectorRequestConfig {
    const httpConfig = connector.config as HttpConnectorConfig | undefined;
    const method = httpConfig?.method || "POST";
    const path = httpConfig?.path || "";

    return {
      url: connector.baseUrl + path,
      method,
      headers: buildRequestHeaders(connector),
      body: JSON.stringify({ messages: input.messages }),
    };
  },

  parseTestResponse(responseText: string): string {
    try {
      const data = JSON.parse(responseText);
      if (data.content) return data.content;
      else if (data.message) return data.message;
      else if (data.response) return data.response;
    } catch {
      // Keep original
    }
    return responseText;
  },

  parseInvokeResponse(responseText: string, _inputMessageCount: number): Message[] {
    try {
      const data = JSON.parse(responseText);
      if (data.message?.content) {
        return [{ role: "assistant", content: data.message.content }];
      } else if (data.content) {
        return [{ role: "assistant", content: data.content }];
      } else if (data.response) {
        return [{ role: "assistant", content: data.response }];
      } else if (data.messages && Array.isArray(data.messages)) {
        const newMessages = data.messages.slice(_inputMessageCount);
        return newMessages
          .filter((msg: Record<string, unknown>) => msg?.role && msg?.content !== undefined)
          .map((msg: Record<string, unknown>) => ({
            role: msg.role as Message["role"],
            content: (msg.content as string) || "",
          }));
      } else if (typeof data === "string") {
        return [{ role: "assistant", content: data }];
      }
    } catch {
      if (responseText.trim()) {
        return [{ role: "assistant", content: responseText }];
      }
    }
    return [];
  },
};

const connectorStrategies: Record<ConnectorType, ConnectorStrategy> = {
  langgraph: langGraphStrategy,
  http: httpStrategy,
};

function getStrategy(type: ConnectorType): ConnectorStrategy {
  const strategy = connectorStrategies[type];
  if (!strategy) {
    throw new Error(`Unknown connector type: ${type}`);
  }
  return strategy;
}

// ============================================================================
// Factory: project-scoped connector module
// ============================================================================

export function createConnectorModule(repo: Repository<Connector>) {
  return {
    async create(input: CreateConnectorInput): Promise<Connector> {
      const connectors = await repo.findAll();

      if (connectors.some((c) => c.name === input.name)) {
        throw new Error(`Connector with name "${input.name}" already exists`);
      }

      const now = new Date().toISOString();
      const connector: Connector = {
        id: randomUUID(),
        name: input.name,
        type: input.type,
        baseUrl: input.baseUrl,
        headers: input.headers,
        config: input.config,
        createdAt: now,
        updatedAt: now,
      };

      connectors.push(connector);
      await repo.saveAll(connectors);

      return connector;
    },

    async get(id: string): Promise<Connector | undefined> {
      return (await repo.findAll()).find((c) => c.id === id);
    },

    async getByName(name: string): Promise<Connector | undefined> {
      return (await repo.findAll()).find((c) => c.name === name);
    },

    async list(): Promise<Connector[]> {
      return repo.findAll();
    },

    async update(id: string, input: UpdateConnectorInput): Promise<Connector | undefined> {
      const connectors = await repo.findAll();
      const index = connectors.findIndex((c) => c.id === id);

      if (index === -1) {
        return undefined;
      }

      const connector = connectors[index];

      if (
        input.name &&
        connectors.some((c) => c.name === input.name && c.id !== id)
      ) {
        throw new Error(`Connector with name "${input.name}" already exists`);
      }

      const updated: Connector = {
        ...connector,
        name: input.name ?? connector.name,
        type: input.type ?? connector.type,
        baseUrl: input.baseUrl ?? connector.baseUrl,
        headers: input.headers !== undefined ? input.headers : connector.headers,
        config: input.config ?? connector.config,
        updatedAt: new Date().toISOString(),
      };

      connectors[index] = updated;
      await repo.saveAll(connectors);

      return updated;
    },

    async delete(id: string): Promise<boolean> {
      const connectors = await repo.findAll();
      const index = connectors.findIndex((c) => c.id === id);

      if (index === -1) {
        return false;
      }

      connectors.splice(index, 1);
      await repo.saveAll(connectors);

      return true;
    },

    async test(id: string): Promise<ConnectorTestResult> {
      const connector = await this.get(id);
      if (!connector) {
        return { success: false, latencyMs: 0, error: `Connector with id "${id}" not found` };
      }

      const strategy = getStrategy(connector.type);
      const requestConfig = strategy.buildTestRequest(connector);

      try {
        const { result, latencyMs } = await withTiming(async () => {
          const response = await fetch(requestConfig.url, {
            method: requestConfig.method,
            headers: requestConfig.headers,
            body: requestConfig.body,
          });
          const responseText = await response.text();
          return { response, responseText };
        });

        const { response, responseText } = result;
        const parsedResponse = strategy.parseTestResponse(responseText);

        if (!response.ok) {
          return {
            success: false,
            latencyMs,
            error: `HTTP ${response.status}: ${parsedResponse.slice(0, 200)}`,
          };
        }

        return { success: true, latencyMs, response: parsedResponse.slice(0, 500) };
      } catch (error) {
        return {
          success: false,
          latencyMs: 0,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },

    async invoke(id: string, input: ConnectorInvokeInput): Promise<ConnectorInvokeResult> {
      const connector = await this.get(id);
      if (!connector) {
        return { success: false, latencyMs: 0, error: `Connector with id "${id}" not found` };
      }

      if (!input.messages || input.messages.length === 0) {
        return { success: false, latencyMs: 0, error: "No messages provided" };
      }

      const strategy = getStrategy(connector.type);
      const requestConfig = strategy.buildInvokeRequest(connector, input);
      const inputMessageCount = input.messages.length;

      try {
        const { result, latencyMs } = await withTiming(async () => {
          const response = await fetch(requestConfig.url, {
            method: requestConfig.method,
            headers: requestConfig.headers,
            body: requestConfig.body,
          });
          const responseText = await response.text();
          return { response, responseText };
        });

        const { response, responseText } = result;
        const newMessages = strategy.parseInvokeResponse(responseText, inputMessageCount);

        if (!response.ok) {
          return {
            success: false,
            latencyMs,
            rawResponse: responseText.slice(0, 500),
            error: `HTTP ${response.status}: ${responseText.slice(0, 200)}`,
          };
        }

        return {
          success: true,
          latencyMs,
          messages: newMessages,
          rawResponse: responseText.slice(0, 2000),
        };
      } catch (error) {
        return {
          success: false,
          latencyMs: 0,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  };
}

export type ConnectorModule = ReturnType<typeof createConnectorModule>;
