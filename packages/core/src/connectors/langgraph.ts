import type { Connector, ConnectorInvokeInput, LangGraphConnectorConfig } from "../connector.js";
import type { Message, TokensUsage } from "../types.js";
import { buildRequestHeaders, type ConnectorRequestConfig, type ConnectorResponseMetadata, type ConnectorStrategy } from "./base.js";

/**
 * LangGraph connector strategy implementation
 *
 * Implements the connector strategy for LangGraph Dev API endpoints.
 * Uses the /info endpoint for testing and /runs/wait for invocations.
 */
export const langGraphStrategy: ConnectorStrategy = {
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

    // Filter out messages that have already been sent (based on their IDs)
    const messagesToSend = input.seenMessageIds && input.seenMessageIds.size > 0
      ? input.messages.filter((msg) => !msg.id || !input.seenMessageIds!.has(msg.id))
      : input.messages;

    return {
      url,
      method: "POST",
      headers: buildRequestHeaders(connector, input.extraHeaders),
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

  parseInvokeResponse(responseText: string, seenMessageIds: Set<string>): {
    messages: Message[];
    metadata: ConnectorResponseMetadata;
  } {
    const result: { messages: Message[]; metadata: ConnectorResponseMetadata } = {
      messages: [],
      metadata: {},
    };

    try {
      const data = JSON.parse(responseText);

      // Extract messages, filtering out messages we've already seen
      if (data.messages && Array.isArray(data.messages)) {
        // Filter raw messages first to identify which are new
        const rawNewMessages = (data.messages as Array<Record<string, unknown>>).filter((msg) => {
          const msgId = typeof msg.id === "string" ? msg.id : undefined;
          return !msgId || !seenMessageIds.has(msgId);
        });

        // Transform new messages to our Message type
        result.messages = rawNewMessages.map((msg) => {
          let role: Message["role"] = "assistant";
          if (msg.type === "human" || msg.role === "user") role = "user";
          else if (msg.type === "tool" || msg.role === "tool") role = "tool";
          else if (msg.type === "system" || msg.role === "system") role = "system";

          const message: Message = { role, content: (msg.content as string) ?? "" };

          if (Array.isArray(msg.tool_calls)) message.tool_calls = msg.tool_calls as Message["tool_calls"];
          if (typeof msg.tool_call_id === "string") message.tool_call_id = msg.tool_call_id;
          if (typeof msg.name === "string") message.name = msg.name;
          if (typeof msg.id === "string") message.id = msg.id;

          // Consolidate external metadata into single catch-all field
          const metadata: Record<string, unknown> = {};
          if (msg.additional_kwargs && typeof msg.additional_kwargs === "object") {
            metadata.additional_kwargs = msg.additional_kwargs;
          }
          if (msg.response_metadata && typeof msg.response_metadata === "object") {
            metadata.response_metadata = msg.response_metadata;
          }
          if (Object.keys(metadata).length > 0) {
            message.metadata = metadata;
          }

          return message;
        });

        // Extract metadata: token usage from ALL new assistant messages
        // (A single invocation can return multiple AI messages, e.g., tool call + response)
        let totalInputTokens = 0;
        let totalOutputTokens = 0;
        let totalTokensSum = 0;

        for (const msg of rawNewMessages) {
          if (msg.type === "ai" || msg.role === "assistant") {
            const usageMetadata = msg.usage_metadata as Record<string, unknown> | undefined;
            if (usageMetadata && typeof usageMetadata === "object") {
              totalInputTokens += (usageMetadata.input_tokens as number) || 0;
              totalOutputTokens += (usageMetadata.output_tokens as number) || 0;
              totalTokensSum += (usageMetadata.total_tokens as number) || 0;
            }
          }
        }

        if (totalInputTokens > 0 || totalOutputTokens > 0) {
          result.metadata.tokensUsage = {
            input_tokens: totalInputTokens,
            output_tokens: totalOutputTokens,
            total_tokens: totalTokensSum || (totalInputTokens + totalOutputTokens),
          };
        }
      }

      // Extract metadata: thread ID
      if (typeof data.thread_id === "string") {
        result.metadata.threadId = data.thread_id;
      }
    } catch {
      // Parsing failed, return empty result
    }

    return result;
  },
};
