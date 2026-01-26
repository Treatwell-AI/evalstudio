import type { Message } from "./types.js";
import type { Persona } from "./persona.js";
import type { Scenario } from "./scenario.js";
import { getLLMProvider } from "./llm-provider.js";
import { chatCompletion, type ChatCompletionMessage } from "./llm-client.js";

/**
 * Input for generating a persona message
 */
export interface GeneratePersonaMessageInput {
  /** The conversation history so far */
  messages: Message[];
  /** The persona to impersonate (optional - if not provided, generates a generic user message) */
  persona?: Persona;
  /** The scenario context */
  scenario: Scenario;
  /** LLM provider ID to use for generation */
  llmProviderId: string;
  /** Model to use (optional, defaults based on provider) */
  model?: string;
}

/**
 * Result of generating a persona message
 */
export interface GeneratePersonaMessageResult {
  /** The generated message content */
  content: string;
  /** Raw response from the LLM */
  rawResponse?: string;
}

/**
 * Builds the system prompt for persona message generation
 */
function buildPersonaSystemPrompt(persona: Persona | undefined, scenario: Scenario): string {
  let prompt: string;

  if (persona) {
    prompt = `You are a test agent simulating a user interaction with a chatbot.
Your role is to impersonate a specific user persona and simulate a realistic conversation
based on the given scenario. Behave naturally as this user would, staying in character
throughout the conversation.

## User Persona

Name: ${persona.name}
`;

    if (persona.description) {
      prompt += `Description: ${persona.description}\n`;
    }

    if (persona.systemPrompt) {
      prompt += `\nCharacter Instructions:\n${persona.systemPrompt}\n`;
    }
  } else {
    prompt = `You are a test agent simulating a user interaction with a chatbot.
Your role is to simulate a realistic conversation based on the given scenario.
Behave naturally as a typical user would throughout the conversation.
`;
  }

  if (scenario.instructions) {
    prompt += `
## Scenario

${scenario.instructions}
`;
  }

  if (scenario.successCriteria) {
    prompt += `
## Goal
Try to achieve the following success criteria through natural conversation:
${scenario.successCriteria}
`;
  }

  prompt += `
## Guidelines

- ${persona ? "Stay in character as the user persona throughout the conversation" : "Act as a realistic user throughout the conversation"}
- Follow the scenario context to guide your messages and goals
- Respond naturally as a real user would, with realistic questions, concerns, or requests
- Do not break character or reveal that you are a test agent
- If the chatbot asks clarifying questions, answer them based on the scenario
- Express appropriate emotions based on the scenario (frustration, curiosity, urgency, etc.)
- Keep responses concise and natural - avoid overly long messages
- Respond ONLY with the user's message content, no additional formatting or explanation`;

  return prompt;
}

/**
 * Generates a user message based on the conversation context.
 * Uses the LLM provider to create a natural response, optionally impersonating a persona.
 * If no persona is provided, generates a generic but contextually appropriate user message.
 */
export async function generatePersonaMessage(
  input: GeneratePersonaMessageInput
): Promise<GeneratePersonaMessageResult> {
  const { messages, persona, scenario, llmProviderId, model } = input;

  // Get the LLM provider
  const llmProvider = getLLMProvider(llmProviderId);
  if (!llmProvider) {
    throw new Error(`LLM Provider with id "${llmProviderId}" not found`);
  }

  // Build system prompt
  const systemPrompt = buildPersonaSystemPrompt(persona, scenario);

  // Build instruction text
  const instructionText = persona
    ? "Based on the conversation above, generate the next message from the user persona. Respond ONLY with the message content."
    : "Based on the conversation above, generate the next message from the user. Respond ONLY with the message content.";

  // Build messages array: system + history + instruction
  const chatMessages: ChatCompletionMessage[] = [
    { role: "system", content: systemPrompt },
  ];

  // Add history messages (skip system messages, map roles)
  for (const m of messages) {
    if (m.role === "system") continue;
    const content = typeof m.content === "string" ? m.content : JSON.stringify(m.content);
    chatMessages.push({
      role: m.role === "assistant" ? "assistant" : "user",
      content,
    });
  }

  // Add instruction message
  chatMessages.push({ role: "user", content: instructionText });

  // Invoke the LLM
  const response = await chatCompletion(llmProvider, chatMessages, { model });

  return {
    content: response.content.trim(),
    rawResponse: response.content,
  };
}
