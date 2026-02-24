import type { EvaluatorDefinition } from "../evaluator.js";
import { toolCallCountEvaluator } from "./tool-call-count.js";
import { tokenUsageEvaluator } from "./token-usage.js";

/**
 * All built-in evaluators, registered at startup.
 */
export const builtinEvaluators: EvaluatorDefinition[] = [
  toolCallCountEvaluator,
  tokenUsageEvaluator,
];
