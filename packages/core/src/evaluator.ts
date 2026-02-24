import type { Message, TokensUsage } from "./types.js";
import type { LLMProvider } from "./llm-provider.js";
import { chatCompletion, type ChatCompletionMessage } from "./llm-client.js";

// ---------------------------------------------------------------------------
// Custom evaluator framework
// ---------------------------------------------------------------------------

/**
 * JSON Schema type for evaluator config validation and UI form generation.
 */
export type JsonSchema = Record<string, unknown>;

/**
 * Defines a custom evaluator (built-in or user-provided).
 * Evaluators can be assertions (pass/fail gates) or metrics (measurements).
 */
export interface EvaluatorDefinition {
  /** Unique type identifier, e.g. "tool-call-count", "my-custom-check". */
  type: string;
  /** Human-readable label for the UI. */
  label: string;
  /** Optional description shown in the UI. */
  description?: string;
  /** Assertion = pass/fail gate. Metric = measurement only (never fails). */
  kind: "assertion" | "metric";
  /** When true, this evaluator runs on every scenario automatically and cannot be removed. */
  auto?: boolean;
  /** JSON Schema for evaluator-specific config. Used for validation and UI form generation. */
  configSchema?: JsonSchema;
  /** Run evaluation on a conversation turn. Called after each connector invocation. */
  evaluate(ctx: EvaluatorContext): Promise<EvaluationResult>;
}

/**
 * Context passed to an evaluator's evaluate() function.
 * Uses existing Message and TokensUsage types — no new shapes.
 */
export interface EvaluatorContext {
  /** Full conversation history (all messages so far). */
  messages: Message[];
  /** Evaluator config from the scenario's evaluators[] entry. */
  config: Record<string, unknown>;
  /** Scenario metadata. */
  scenario: {
    name: string;
    instructions?: string;
    maxMessages?: number;
  };
  /** Persona metadata, if present. */
  persona?: {
    name: string;
    description?: string;
  };
  /** Data from the most recent connector invocation. */
  lastInvocation: {
    /** Response time for this invocation (ms). */
    latencyMs: number;
    /** New messages returned by the connector in this turn. */
    messages: Message[];
    /** Token usage, if the connector provides it. Same TokensUsage type used by connectors and runs. */
    tokensUsage?: TokensUsage;
  };
  /** 1-indexed turn number. */
  turn: number;
  /** True if this is the last turn (max messages reached or early exit). */
  isFinal: boolean;
}

/**
 * Result returned by an evaluator's evaluate() function.
 */
export interface EvaluationResult {
  /** Pass/fail. Assertions: false = run fails. Metrics: always true. */
  success: boolean;
  /** Numeric value. Metrics: the measured value. Assertions: optional 0-1 score. */
  value?: number;
  /** Human-readable explanation. */
  reason: string;
  /** Structured data for debugging/analysis. */
  metadata?: Record<string, unknown>;
}

/**
 * Reference to an evaluator on a scenario.
 */
export interface ScenarioEvaluator {
  /** Evaluator type — references a registered evaluator. */
  type: string;
  /** Type-specific config, validated against the evaluator's configSchema. */
  config?: Record<string, unknown>;
}

/**
 * Single evaluator result stored on a run.
 */
export interface EvaluatorResultEntry {
  type: string;
  label: string;
  kind: "assertion" | "metric";
  success: boolean;
  value?: number;
  reason: string;
  metadata?: Record<string, unknown>;
}

/**
 * Aggregated result from running all evaluators on a turn.
 */
export interface AggregatedEvaluationResult {
  /** True if all assertions passed. */
  success: boolean;
  /** Min score across assertions, or undefined if no assertions have scores. */
  score?: number;
  /** First assertion failure reason, or "All evaluators passed". */
  reason: string;
  /** Per-evaluator results. */
  evaluatorResults: EvaluatorResultEntry[];
  /** Quick metric lookup: { "tool-call-count": 3, ... } */
  metrics: Record<string, number>;
}

/**
 * Runs all evaluators in parallel and aggregates results.
 *
 * - Assertions: all must pass for success. Score = min(assertion scores).
 * - Metrics: tracked but never cause failure. Values stored in metrics map.
 */
export async function runEvaluators(
  evaluators: Array<{ definition: EvaluatorDefinition; config: Record<string, unknown> }>,
  context: Omit<EvaluatorContext, "config">
): Promise<AggregatedEvaluationResult> {
  const settled = await Promise.allSettled(
    evaluators.map(async ({ definition, config }) => {
      const result = await definition.evaluate({ ...context, config });
      return { definition, result };
    })
  );

  const evaluatorResults: EvaluatorResultEntry[] = [];
  const metrics: Record<string, number> = {};
  let allAssertionsPassed = true;
  let minScore: number | undefined;
  let firstFailureReason: string | undefined;

  for (const outcome of settled) {
    if (outcome.status === "rejected") {
      // Evaluator threw — treat as failed assertion
      const reason = `Evaluator error: ${outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason)}`;
      evaluatorResults.push({
        type: "unknown",
        label: "Unknown",
        kind: "assertion",
        success: false,
        reason,
      });
      allAssertionsPassed = false;
      if (!firstFailureReason) firstFailureReason = reason;
      continue;
    }

    const { definition, result } = outcome.value;
    const entry: EvaluatorResultEntry = {
      type: definition.type,
      label: definition.label,
      kind: definition.kind,
      success: result.success,
      value: result.value,
      reason: result.reason,
      metadata: result.metadata,
    };
    evaluatorResults.push(entry);

    if (definition.kind === "metric") {
      if (result.value !== undefined) {
        metrics[definition.type] = result.value;
      }
    } else {
      // Assertion
      if (!result.success) {
        allAssertionsPassed = false;
        if (!firstFailureReason) firstFailureReason = result.reason;
      }
      if (result.value !== undefined) {
        minScore = minScore === undefined ? result.value : Math.min(minScore, result.value);
      }
    }
  }

  return {
    success: allAssertionsPassed,
    score: minScore,
    reason: firstFailureReason ?? "All evaluators passed",
    evaluatorResults,
    metrics,
  };
}

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
  /** LLM provider to use for evaluation */
  llmProvider: LLMProvider;
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
  const { messages, successCriteria, failureCriteria, llmProvider, model } = input;

  // If no criteria defined, return inconclusive
  if (!successCriteria && !failureCriteria) {
    return {
      successMet: false,
      failureMet: false,
      confidence: 1,
      reasoning: "No evaluation criteria defined",
    };
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
