import type { EvaluatorDefinition } from "../evaluator.js";

/**
 * Built-in metric: reports token usage for the agent's response.
 * Requires a connector that returns token usage metadata (e.g. LangGraph).
 */
export const tokenUsageEvaluator: EvaluatorDefinition = {
  type: "token-usage",
  label: "Token Usage",
  description:
    "Reports input/output/total token usage per turn. Requires a connector that returns usage metadata (e.g. LangGraph).",
  kind: "metric",
  auto: true,
  configSchema: { type: "object", properties: {}, additionalProperties: false },

  async evaluate(ctx) {
    const usage = ctx.lastInvocation.tokensUsage;

    if (!usage) {
      return {
        success: true,
        value: 0,
        reason: "No token usage reported by connector",
        metadata: {},
      };
    }

    return {
      success: true,
      value: usage.total_tokens,
      reason: `${usage.total_tokens} tokens (${usage.input_tokens} in, ${usage.output_tokens} out)`,
      metadata: { ...usage },
    };
  },
};
