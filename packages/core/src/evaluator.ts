import type { Message } from "./types.js";
import { getLLMProvider } from "./llm-provider.js";
import { chatCompletion, type ChatCompletionMessage } from "./llm-client.js";

/**
 * Result of evaluating conversation against success/failure criteria
 */
export interface CriteriaEvaluationResult {
  /** Whether the success criteria has been met */
  successMet: boolean;
  /** Whether the failure criteria has been met */
  failureMet: boolean;
  /** Confidence score (0-1) for the evaluation decision */
  confidence: number;
  /** Reasoning for the evaluation decision */
  reasoning: string;
  /** Raw response from the LLM evaluator */
  rawResponse?: string;
}

/**
 * Input for criteria evaluation
 */
export interface EvaluateCriteriaInput {
  /** The conversation history to evaluate */
  messages: Message[];
  /** Success criteria to check against */
  successCriteria?: string;
  /** Failure criteria to check against */
  failureCriteria?: string;
  /** LLM provider ID to use for evaluation */
  llmProviderId: string;
  /** Model to use (optional, defaults based on provider) */
  model?: string;
}

/**
 * Validates and extracts the evaluation result from parsed JSON
 */
function validateEvaluationResult(
  parsed: unknown
): { successMet: boolean; failureMet: boolean; confidence: number; reasoning: string } {
  if (
    typeof parsed !== "object" || parsed === null ||
    typeof (parsed as Record<string, unknown>).successMet !== "boolean" ||
    typeof (parsed as Record<string, unknown>).failureMet !== "boolean" ||
    typeof (parsed as Record<string, unknown>).confidence !== "number" ||
    ((parsed as Record<string, unknown>).confidence as number) < 0 ||
    ((parsed as Record<string, unknown>).confidence as number) > 1 ||
    typeof (parsed as Record<string, unknown>).reasoning !== "string"
  ) {
    throw new Error("Invalid evaluation result shape");
  }
  const p = parsed as Record<string, unknown>;
  return {
    successMet: p.successMet as boolean,
    failureMet: p.failureMet as boolean,
    confidence: p.confidence as number,
    reasoning: p.reasoning as string,
  };
}

/**
 * Formats conversation messages for evaluation
 */
function formatConversation(messages: Message[]): string {
  return messages
    .filter((m) => m.role !== "system")
    .map((m) => {
      const role = m.role === "assistant" ? "Agent" : "User";
      const content = typeof m.content === "string" ? m.content : JSON.stringify(m.content);
      return `${role}: ${content}`;
    })
    .join("\n\n");
}

/**
 * Parses the LLM response into a CriteriaEvaluationResult
 */
function parseEvaluationResponse(response: string): Omit<CriteriaEvaluationResult, "rawResponse"> {
  try {
    // Try to extract JSON from the response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const validated = validateEvaluationResult(parsed);
    return validated;
  } catch {
    // Default to inconclusive if parsing fails
    return {
      successMet: false,
      failureMet: false,
      confidence: 0,
      reasoning: `Failed to parse evaluation response: ${response.slice(0, 200)}`,
    };
  }
}

/**
 * Evaluates conversation against success/failure criteria using an LLM judge.
 * Returns the evaluation result indicating whether criteria have been met.
 */
export async function evaluateCriteria(
  input: EvaluateCriteriaInput
): Promise<CriteriaEvaluationResult> {
  const { messages, successCriteria, failureCriteria, llmProviderId, model } = input;

  // If no criteria defined, return inconclusive
  if (!successCriteria && !failureCriteria) {
    return {
      successMet: false,
      failureMet: false,
      confidence: 1,
      reasoning: "No evaluation criteria defined",
    };
  }

  // Get the LLM provider
  const llmProvider = getLLMProvider(llmProviderId);
  if (!llmProvider) {
    throw new Error(`LLM Provider with id "${llmProviderId}" not found`);
  }

  // Format conversation and build messages
  const conversation = formatConversation(messages);

  const chatMessages: ChatCompletionMessage[] = [
    {
      role: "system",
      content: `You are an evaluation judge. Analyze conversations between a User and an Agent to determine if specific criteria have been met.

You must respond with a JSON object containing:
- successMet: boolean - whether the success criteria has been met
- failureMet: boolean - whether the failure criteria has been met
- confidence: number - your confidence level from 0.0 to 1.0
- reasoning: string - brief explanation of your evaluation decision

Respond ONLY with the JSON object, no additional text.`,
    },
    {
      role: "user",
      content: `## Conversation
${conversation}

## Evaluation Criteria

### Success Criteria
${successCriteria || "No success criteria defined."}

### Failure Criteria
${failureCriteria || "No failure criteria defined."}

Analyze the conversation and determine if the criteria have been met.`,
    },
  ];

  // Invoke the LLM
  const response = await chatCompletion(llmProvider, chatMessages, { model });

  // Parse and return result
  const result = parseEvaluationResponse(response.content);
  return {
    ...result,
    rawResponse: response.content,
  };
}
