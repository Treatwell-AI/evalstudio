/**
 * Shared types used across multiple modules.
 */

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
export function getMessageContentAsString(
  content: string | ContentBlock[]
): string {
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
