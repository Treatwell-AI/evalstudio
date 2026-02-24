/**
 * Shared types used across multiple modules.
 */

/**
 * Normalized token usage following industry standards (LangGraph, Anthropic format).
 */
export interface TokensUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}

/**
 * A tool call made by an assistant message (OpenAI format).
 */
export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string; // JSON string, not parsed object
  };
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
  content: string | ContentBlock[] | null;
  /** Tool calls made by the assistant */
  tool_calls?: ToolCall[];
  /** Tool call ID (for tool response messages) */
  tool_call_id?: string;
  /** Message name (e.g., tool name for tool messages) */
  name?: string;
  /** Message ID */
  id?: string;
  /** Debug/passthrough metadata from external systems (not consumed by application) */
  metadata?: Record<string, unknown>;
}

/**
 * Normalizes message content to a string.
 * If content is already a string, returns it as-is.
 * If content is an array of ContentBlocks, extracts and joins text content.
 * If content is null, returns an empty string.
 */
export function getMessageContentAsString(
  content: string | ContentBlock[] | null
): string {
  if (content === null) {
    return "";
  }
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((block) => {
        if (block.type === "text" && block.text) {
          return block.text;
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  return "";
}
