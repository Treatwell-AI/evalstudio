import type { Connector, ConnectorInvokeInput } from "../connector.js";
import type { Message, TokensUsage } from "../types.js";

/**
 * Configuration for a connector request
 */
export interface ConnectorRequestConfig {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

/**
 * Metadata extracted from connector responses
 */
export interface ConnectorResponseMetadata {
  tokensUsage?: TokensUsage;
  threadId?: string;
}

/**
 * Strategy interface that each connector type must implement
 */
export interface ConnectorStrategy {
  /**
   * Build the request configuration for testing the connector
   */
  buildTestRequest(connector: Connector): ConnectorRequestConfig;

  /**
   * Build the request configuration for invoking the connector with messages
   */
  buildInvokeRequest(connector: Connector, input: ConnectorInvokeInput): ConnectorRequestConfig;

  /**
   * Parse the response from a test request
   */
  parseTestResponse(responseText: string): string;

  /**
   * Parse the response from an invoke request and extract new messages and metadata
   * @param responseText The response text from the connector
   * @param seenMessageIds IDs of messages that have already been seen (to filter out)
   */
  parseInvokeResponse(responseText: string, seenMessageIds: Set<string>): {
    messages: Message[];
    metadata: ConnectorResponseMetadata;
  };
}

/**
 * Build request headers by merging default headers with connector headers and extra headers
 */
export function buildRequestHeaders(
  connector: Connector,
  extraHeaders?: Record<string, string>
): Record<string, string> {
  return {
    "Content-Type": "application/json",
    ...connector.headers,
    ...extraHeaders,
  };
}
