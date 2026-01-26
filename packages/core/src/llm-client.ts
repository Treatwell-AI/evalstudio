import type { LLMProvider, ProviderType } from "./llm-provider.js";

/**
 * A message in the standard chat completion format.
 */
export interface ChatCompletionMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * The result of a chat completion call.
 */
export interface ChatCompletionResult {
  content: string;
}

/**
 * Options for the chat completion call.
 */
export interface ChatCompletionOptions {
  model?: string;
  temperature?: number;
}

/**
 * Returns the default model for a given provider type.
 */
export function getDefaultModelForProvider(providerType: ProviderType): string {
  switch (providerType) {
    case "openai":
      return "gpt-4o-mini";
    case "anthropic":
      return "claude-3-5-haiku-20241022";
    default:
      return "gpt-4o-mini";
  }
}

/**
 * Sends a chat completion request to the appropriate provider API.
 * Supports OpenAI and Anthropic via native fetch().
 */
export async function chatCompletion(
  provider: LLMProvider,
  messages: ChatCompletionMessage[],
  options?: ChatCompletionOptions
): Promise<ChatCompletionResult> {
  const model = options?.model || getDefaultModelForProvider(provider.provider);

  switch (provider.provider) {
    case "openai":
      return openaiChatCompletion(provider, model, messages, options);
    case "anthropic":
      return anthropicChatCompletion(provider, model, messages, options);
    default:
      throw new Error(`Unsupported LLM provider: ${provider.provider}`);
  }
}

/**
 * OpenAI Chat Completions API.
 */
async function openaiChatCompletion(
  provider: LLMProvider,
  model: string,
  messages: ChatCompletionMessage[],
  options?: ChatCompletionOptions
): Promise<ChatCompletionResult> {
  const body: Record<string, unknown> = {
    model,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  };

  if (options?.temperature !== undefined) {
    body.temperature = options.temperature;
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${provider.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${errorBody}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { role: string; content: string } }>;
  };

  const content = data.choices?.[0]?.message?.content;
  if (content === undefined || content === null) {
    throw new Error("OpenAI API returned no content in response");
  }

  return { content };
}

/**
 * Anthropic Messages API.
 *
 * Handles Anthropic-specific requirements:
 * - System message extracted to top-level `system` field
 * - Messages must alternate user/assistant (consecutive same-role merged)
 * - max_tokens is required
 */
async function anthropicChatCompletion(
  provider: LLMProvider,
  model: string,
  messages: ChatCompletionMessage[],
  options?: ChatCompletionOptions
): Promise<ChatCompletionResult> {
  // Extract system message(s)
  const systemParts: string[] = [];
  const nonSystemMessages: Array<{ role: "user" | "assistant"; content: string }> = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      systemParts.push(msg.content);
    } else {
      nonSystemMessages.push({ role: msg.role, content: msg.content });
    }
  }

  // Merge consecutive same-role messages (Anthropic requires alternation)
  const mergedMessages: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const msg of nonSystemMessages) {
    const last = mergedMessages[mergedMessages.length - 1];
    if (last && last.role === msg.role) {
      last.content += "\n\n" + msg.content;
    } else {
      mergedMessages.push({ ...msg });
    }
  }

  const body: Record<string, unknown> = {
    model,
    max_tokens: 4096,
    messages: mergedMessages,
  };

  if (systemParts.length > 0) {
    body.system = systemParts.join("\n\n");
  }

  if (options?.temperature !== undefined) {
    body.temperature = options.temperature;
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": provider.apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Anthropic API error (${response.status}): ${errorBody}`);
  }

  const data = (await response.json()) as {
    content: Array<{ type: string; text?: string }>;
  };

  const textBlock = data.content?.find((c) => c.type === "text");
  if (!textBlock?.text) {
    throw new Error("Anthropic API returned no text content in response");
  }

  return { content: textBlock.text };
}
