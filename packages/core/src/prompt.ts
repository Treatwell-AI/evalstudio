import type { Persona } from "./persona.js";
import type { Scenario } from "./scenario.js";
import { getMessageContentAsString } from "./types.js";

/**
 * Input for building the test agent system prompt.
 * Accepts partial persona/scenario objects so it can work with
 * both full entities and the embedded relations from EvalWithRelations.
 */
export interface BuildTestAgentPromptInput {
  persona?: Pick<Persona, "name" | "description" | "systemPrompt"> | null;
  scenario?: Pick<Scenario, "name" | "instructions" | "messages"> | null;
}

/**
 * Builds the system prompt for the test agent that will impersonate
 * a user persona and simulate a scenario when interacting with the
 * chatbot being tested.
 *
 * The test agent's role is to act as a realistic user, following the
 * persona's characteristics and the scenario's context to evaluate
 * how well the chatbot handles the interaction.
 */
export function buildTestAgentSystemPrompt(input: BuildTestAgentPromptInput): string {
  const { persona, scenario } = input;

  let personaContent = "";
  if (persona) {
    personaContent = `
## User Persona

Name:
${persona.name || "N/A"}

Character Instructions:
${persona.systemPrompt || "N/A"}`;
  }

  let scenarioContent = "";
  if (scenario?.instructions) {
    scenarioContent = `
## Scenario

${scenario.instructions}
`;
  }

  const systemPrompt: string = `
You are a test agent simulating a user interaction with a chatbot.
Your role is to impersonate a specific user persona and simulate a realistic conversation
based on the given scenario. Behave naturally as this user would, staying in character
throughout the conversation.

${personaContent}

${scenarioContent}

## Guidelines

- Stay in character as the user persona throughout the conversation
- Follow the scenario context to guide your messages and goals
- Respond naturally as a real user would, with realistic questions, concerns, or requests
- Do not break character or reveal that you are a test agent
- If the chatbot asks clarifying questions, answer them based on the persona and scenario
- Express appropriate emotions based on the scenario (frustration, curiosity, urgency, etc.)`;

  return systemPrompt;
}

/**
 * Builds a messages array in OpenAI format for the test agent,
 * starting with the system prompt and including any initial seed
 * messages from the scenario.
 */
export function buildTestAgentMessages(
  input: BuildTestAgentPromptInput
): Array<{ role: "system" | "user" | "assistant"; content: string }> {
  const systemPrompt = buildTestAgentSystemPrompt(input);
  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
  ];

  // Include scenario's initial seed messages if present
  if (input.scenario?.messages && input.scenario.messages.length > 0) {
    for (const msg of input.scenario.messages) {
      messages.push({
        role: msg.role as "system" | "user" | "assistant",
        content: getMessageContentAsString(msg.content),
      });
    }
  }

  return messages;
}
