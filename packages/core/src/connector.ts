import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getStorageDir } from "./storage.js";
import type { Message } from "./types.js";

export type ConnectorType = "http" | "langgraph";

export type AuthType = "none" | "api-key" | "bearer" | "basic";

/**
 * Configuration for LangGraph Dev API connectors
 */
export interface LangGraphConnectorConfig {
  /** The assistant ID to use when invoking the LangGraph agent (required) */
  assistantId: string;
}

/**
 * Configuration for generic HTTP/REST API connectors
 */
export interface HttpConnectorConfig {
  /** HTTP method to use (defaults to POST) */
  method?: "GET" | "POST" | "PUT" | "PATCH";
  /** Additional headers to include in requests */
  headers?: Record<string, string>;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Path to append to base URL for requests */
  path?: string;
}

/** Union type for all connector configurations */
export type ConnectorConfig = LangGraphConnectorConfig | HttpConnectorConfig;

export interface Connector {
  id: string;
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

function getStoragePath(): string {
  return join(getStorageDir(), "connectors.json");
}

function loadConnectors(): Connector[] {
  const path = getStoragePath();
  if (!existsSync(path)) {
    return [];
  }
  const data = readFileSync(path, "utf-8");
  return JSON.parse(data) as Connector[];
}

function saveConnectors(connectors: Connector[]): void {
  const path = getStoragePath();
  writeFileSync(path, JSON.stringify(connectors, null, 2));
}

export function createConnector(input: CreateConnectorInput): Connector {
  const connectors = loadConnectors();

  if (connectors.some((c) => c.name === input.name)) {
    throw new Error(
      `Connector with name "${input.name}" already exists`
    );
  }

  const now = new Date().toISOString();
  const connector: Connector = {
    id: randomUUID(),
    name: input.name,
    type: input.type,
    baseUrl: input.baseUrl,
    authType: input.authType,
    authValue: input.authValue,
    config: input.config,
    createdAt: now,
    updatedAt: now,
  };

  connectors.push(connector);
  saveConnectors(connectors);

  return connector;
}

export function getConnector(id: string): Connector | undefined {
  const connectors = loadConnectors();
  return connectors.find((c) => c.id === id);
}

export function getConnectorByName(name: string): Connector | undefined {
  const connectors = loadConnectors();
  return connectors.find((c) => c.name === name);
}

export function listConnectors(): Connector[] {
  return loadConnectors();
}

export function updateConnector(
  id: string,
  input: UpdateConnectorInput
): Connector | undefined {
  const connectors = loadConnectors();
  const index = connectors.findIndex((c) => c.id === id);

  if (index === -1) {
    return undefined;
  }

  const connector = connectors[index];

  if (
    input.name &&
    connectors.some((c) => c.name === input.name && c.id !== id)
  ) {
    throw new Error(
      `Connector with name "${input.name}" already exists`
    );
  }

  // Determine the new authType
  const newAuthType = input.authType ?? connector.authType;

  // Clear authValue if authType is being set to "none"
  const newAuthValue =
    newAuthType === "none"
      ? undefined
      : input.authValue ?? connector.authValue;

  const updated: Connector = {
    ...connector,
    name: input.name ?? connector.name,
    type: input.type ?? connector.type,
    baseUrl: input.baseUrl ?? connector.baseUrl,
    authType: newAuthType,
    authValue: newAuthValue,
    config: input.config ?? connector.config,
    updatedAt: new Date().toISOString(),
  };

  connectors[index] = updated;
  saveConnectors(connectors);

  return updated;
}

export function deleteConnector(id: string): boolean {
  const connectors = loadConnectors();
  const index = connectors.findIndex((c) => c.id === id);

  if (index === -1) {
    return false;
  }

  connectors.splice(index, 1);
  saveConnectors(connectors);

  return true;
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

export interface ConnectorTestResult {
  success: boolean;
  latencyMs: number;
  response?: string;
  error?: string;
}

export interface ConnectorInvokeInput {
  messages: Message[];
  /** Optional run ID to use as thread_id for LangGraph connectors */
  runId?: string;
  /** Number of messages already in the thread (for LangGraph continuations) */
  threadMessageCount?: number;
}

export interface ConnectorInvokeResult {
  success: boolean;
  latencyMs: number;
  /** All new messages from the connector (may include tool calls, tool results, and assistant messages) */
  messages?: Message[];
  rawResponse?: string;
  error?: string;
}

// ============================================================================
// Connector Strategy Pattern
// ============================================================================

interface ConnectorRequestConfig {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

interface ConnectorStrategy {
  /** Build request config for testing the connector */
  buildTestRequest(connector: Connector): ConnectorRequestConfig;
  /** Build request config for invoking the connector */
  buildInvokeRequest(
    connector: Connector,
    input: ConnectorInvokeInput
  ): ConnectorRequestConfig;
  /** Parse test response and extract display text */
  parseTestResponse(responseText: string): string;
  /** Parse invoke response and extract new messages (may include tool calls, tool results, assistant messages) */
  parseInvokeResponse(responseText: string, inputMessageCount: number): Message[];
}

// ============================================================================
// Shared Utilities
// ============================================================================

function buildAuthHeaders(connector: Connector): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (connector.authType === "api-key" && connector.authValue) {
    headers["X-API-Key"] = connector.authValue;
  } else if (connector.authType === "bearer" && connector.authValue) {
    headers["Authorization"] = `Bearer ${connector.authValue}`;
  } else if (connector.authType === "basic" && connector.authValue) {
    headers["Authorization"] = `Basic ${connector.authValue}`;
  }

  return headers;
}

async function withTiming<T>(
  fn: () => Promise<T>
): Promise<{ result: T; latencyMs: number }> {
  const startTime = Date.now();
  const result = await fn();
  return { result, latencyMs: Date.now() - startTime };
}

// ============================================================================
// LangGraph Strategy
// ============================================================================

const langGraphStrategy: ConnectorStrategy = {
  buildTestRequest(connector: Connector): ConnectorRequestConfig {
    // https://docs.langchain.com/langsmith/agent-server-api/system/server-information

    return {
      url: `${connector.baseUrl}/info`,
      method: "GET",
      headers: buildAuthHeaders(connector)
    };
  },

  buildInvokeRequest(
    connector: Connector,
    input: ConnectorInvokeInput
  ): ConnectorRequestConfig {
    const lgConfig = connector.config as LangGraphConnectorConfig | undefined;
    const assistantId = lgConfig?.assistantId || "default";

    // https://docs.langchain.com/langsmith/agent-server-api/thread-runs/create-run-wait-for-output
    // Use thread-scoped endpoint if runId is provided for better organization in LangSmith
    const url = input.runId
      ? `${connector.baseUrl}/threads/${input.runId}/runs/wait`
      : `${connector.baseUrl}/runs/wait`;

    // For thread continuations, only send NEW messages (thread already has the history)
    // threadMessageCount is the number of messages already in the thread state
    const messagesToSend = input.threadMessageCount !== undefined && input.threadMessageCount > 0
      ? input.messages.slice(input.threadMessageCount)
      : input.messages;

    return {
      url,
      method: "POST",
      headers: buildAuthHeaders(connector),
      body: JSON.stringify({
        assistant_id: assistantId,
        input: {
          messages: messagesToSend,
        },
        // Queue subsequent runs on the same thread instead of rejecting
        multitask_strategy: "enqueue",
        // Auto-create thread if it doesn't exist (avoids separate API call)
        if_not_exists: "create",
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
      // Keep original response text if parsing fails
    }
    return responseText;
  },

  parseInvokeResponse(responseText: string, inputMessageCount: number): Message[] {
    try {
      const data = JSON.parse(responseText);
      if (data.messages && Array.isArray(data.messages)) {
        // LangGraph returns all messages including input - extract only the new ones
        const newMessages = data.messages.slice(inputMessageCount);

        return newMessages.map((msg: Record<string, unknown>) => {
          // Determine role from LangGraph message type
          let role: Message["role"] = "assistant";
          if (msg.type === "human" || msg.role === "user") {
            role = "user";
          } else if (msg.type === "tool" || msg.role === "tool") {
            role = "tool";
          } else if (msg.type === "system" || msg.role === "system") {
            role = "system";
          }

          const message: Message = {
            role,
            content: (msg.content as string) ?? "",
          };

          // Include optional LangGraph message fields if present
          if (Array.isArray(msg.tool_calls)) {
            message.tool_calls = msg.tool_calls as Message["tool_calls"];
          }
          if (typeof msg.tool_call_id === "string") {
            message.tool_call_id = msg.tool_call_id;
          }
          if (typeof msg.name === "string") {
            message.name = msg.name;
          }
          if (msg.additional_kwargs && typeof msg.additional_kwargs === "object") {
            message.additional_kwargs = msg.additional_kwargs as Record<string, unknown>;
          }
          if (msg.response_metadata && typeof msg.response_metadata === "object") {
            message.response_metadata = msg.response_metadata as Record<string, unknown>;
          }
          if (typeof msg.id === "string") {
            message.id = msg.id;
          }

          return message;
        });
      }
    } catch {
      // Parsing failed
    }
    return [];
  },
};

// ============================================================================
// HTTP Strategy
// ============================================================================

const httpStrategy: ConnectorStrategy = {
  buildTestRequest(connector: Connector): ConnectorRequestConfig {
    return {
      url: connector.baseUrl,
      method: "POST",
      headers: buildAuthHeaders(connector),
      body: JSON.stringify({
        message: "hello",
        messages: [{ role: "user", content: "hello" }],
      }),
    };
  },

  buildInvokeRequest(
    connector: Connector,
    input: ConnectorInvokeInput
  ): ConnectorRequestConfig {
    const httpConfig = connector.config as HttpConnectorConfig | undefined;
    const method = httpConfig?.method || "POST";
    const path = httpConfig?.path || "";

    return {
      url: connector.baseUrl + path,
      method,
      headers: { ...buildAuthHeaders(connector), ...httpConfig?.headers },
      body: JSON.stringify({
        messages: input.messages,
      }),
    };
  },

  parseTestResponse(responseText: string): string {
    try {
      const data = JSON.parse(responseText);
      if (data.content) {
        return data.content;
      } else if (data.message) {
        return data.message;
      } else if (data.response) {
        return data.response;
      }
    } catch {
      // Keep original response text if parsing fails
    }
    return responseText;
  },

  parseInvokeResponse(responseText: string, inputMessageCount: number): Message[] {
    try {
      const data = JSON.parse(responseText);
      // Support various response formats
      if (data.message?.content) {
        return [{
          role: "assistant",
          content: data.message.content,
        }];
      } else if (data.content) {
        return [{
          role: "assistant",
          content: data.content,
        }];
      } else if (data.response) {
        return [{
          role: "assistant",
          content: data.response,
        }];
      } else if (data.messages && Array.isArray(data.messages)) {
        // Return all new messages after the input
        const newMessages = data.messages.slice(inputMessageCount);
        return newMessages
          .filter((msg: Record<string, unknown>) => msg?.role && msg?.content !== undefined)
          .map((msg: Record<string, unknown>) => ({
            role: msg.role as Message["role"],
            content: (msg.content as string) || "",
          }));
      } else if (typeof data === "string") {
        return [{
          role: "assistant",
          content: data,
        }];
      }
    } catch {
      // If parsing fails and response is plain text, use it as content
      if (responseText.trim()) {
        return [{
          role: "assistant",
          content: responseText,
        }];
      }
    }
    return [];
  },
};

// ============================================================================
// Strategy Registry
// ============================================================================

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

/**
 * Tests a connector by sending a "hello" message and checking the response.
 * Returns the test result with success status, latency, and response or error.
 */
export async function testConnector(id: string): Promise<ConnectorTestResult> {
  const connector = getConnector(id);
  if (!connector) {
    return {
      success: false,
      latencyMs: 0,
      error: `Connector with id "${id}" not found`,
    };
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

    return {
      success: true,
      latencyMs,
      response: parsedResponse.slice(0, 500),
    };
  } catch (error) {
    return {
      success: false,
      latencyMs: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Invokes a connector by sending messages and returning the assistant's response.
 * Returns the result with success status, latency, response message, or error.
 */
export async function invokeConnector(
  id: string,
  input: ConnectorInvokeInput
): Promise<ConnectorInvokeResult> {
  const connector = getConnector(id);
  if (!connector) {
    return {
      success: false,
      latencyMs: 0,
      error: `Connector with id "${id}" not found`,
    };
  }

  if (!input.messages || input.messages.length === 0) {
    return {
      success: false,
      latencyMs: 0,
      error: "No messages provided",
    };
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
}
