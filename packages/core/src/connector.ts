import { randomUUID } from "node:crypto";
import type { Repository } from "./repository.js";
import type { Message, TokensUsage } from "./types.js";
import type { ConnectorStrategy } from "./connectors/index.js";
import { langGraphStrategy } from "./connectors/index.js";

export type ConnectorType = "langgraph";

export interface LangGraphConnectorConfig {
  assistantId: string;
  configurable?: Record<string, unknown>;
}

export type ConnectorConfig = LangGraphConnectorConfig;

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
  /** IDs of messages that have already been sent (for filtering) */
  seenMessageIds?: Set<string>;
  /** Extra headers to merge with connector headers (take precedence over connector headers) */
  extraHeaders?: Record<string, string>;
}

export interface ConnectorInvokeResult {
  success: boolean;
  latencyMs: number;
  messages?: Message[];
  rawResponse?: string;
  error?: string;

  // Normalized metadata
  tokensUsage?: TokensUsage;
  threadId?: string;
}

/**
 * Returns the supported connector types with their descriptions
 */
export function getConnectorTypes(): Record<ConnectorType, string> {
  return {
    langgraph: "LangGraph Dev API connector for langgraph-backed agents",
  };
}

// ============================================================================
// Connector Strategy Registry
// ============================================================================

/**
 * Registry of connector strategies
 * Each connector type has its own strategy implementation in the connectors/ folder
 */
const connectorStrategies: Record<ConnectorType, ConnectorStrategy> = {
  langgraph: langGraphStrategy,
};

/**
 * Get the strategy for a given connector type
 */
function getStrategy(type: ConnectorType): ConnectorStrategy {
  const strategy = connectorStrategies[type];
  if (!strategy) {
    throw new Error(`Unknown connector type: ${type}`);
  }
  return strategy;
}

/**
 * Helper to measure execution time of async operations
 */
async function withTiming<T>(
  fn: () => Promise<T>
): Promise<{ result: T; latencyMs: number }> {
  const startTime = Date.now();
  const result = await fn();
  return { result, latencyMs: Date.now() - startTime };
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

      // Build set of seen message IDs (messages we already have)
      const seenMessageIds = input.seenMessageIds || new Set<string>();

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
        const parsedResponse = strategy.parseInvokeResponse(responseText, seenMessageIds);

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
          messages: parsedResponse.messages,
          rawResponse: responseText.slice(0, 2000),
          tokensUsage: parsedResponse.metadata.tokensUsage,
          threadId: parsedResponse.metadata.threadId,
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
