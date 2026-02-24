import type { EvaluatorResultEntry } from "../lib/api";

export interface LLMCriteriaResult {
  successMet?: boolean;
  failureMet?: boolean;
  confidence?: number;
  reasoning?: string;
  messageCount?: number;
  avgLatencyMs?: number;
  maxMessagesReached?: boolean;
}

interface EvaluatorResultsProps {
  /** LLM-as-judge criteria evaluation (shown first) */
  criteria?: LLMCriteriaResult | null;
  /** Custom evaluator results */
  evaluatorResults?: EvaluatorResultEntry[];
  /** Metrics from output */
  metrics?: Record<string, number>;
}

export function EvaluatorResults({ criteria, evaluatorResults, metrics }: EvaluatorResultsProps) {
  const assertions = evaluatorResults?.filter((r) => r.kind === "assertion") ?? [];
  const metricResults = evaluatorResults?.filter((r) => r.kind === "metric") ?? [];
  const hasCriteria = criteria && (criteria.successMet !== undefined || criteria.failureMet !== undefined);
  const hasEvaluators = assertions.length > 0 || metricResults.length > 0;

  if (!hasCriteria && !hasEvaluators) return null;

  return (
    <div className="evaluator-results">
      {hasCriteria && (
        <div className="evaluator-results-section">
          <div className="run-evaluation-header">Evaluation Details</div>
          <div className="run-evaluation-grid">
            {criteria.messageCount !== undefined && (
              <div className="run-evaluation-item">
                <span className="run-evaluation-label">Messages</span>
                <span className="run-evaluation-value">{criteria.messageCount}</span>
              </div>
            )}
            {criteria.avgLatencyMs !== undefined && (
              <div className="run-evaluation-item">
                <span className="run-evaluation-label">Avg Latency</span>
                <span className="run-evaluation-value">
                  {criteria.avgLatencyMs >= 1000
                    ? `${(criteria.avgLatencyMs / 1000).toFixed(1)}s`
                    : `${criteria.avgLatencyMs}ms`}
                </span>
              </div>
            )}
            {criteria.successMet !== undefined && (
              <div className="run-evaluation-item">
                <span className="run-evaluation-label">Success Criteria</span>
                <span className={`run-evaluation-value ${criteria.successMet ? "met" : "not-met"}`}>
                  {criteria.successMet ? "Met" : "Not Met"}
                </span>
              </div>
            )}
            {criteria.failureMet !== undefined && (
              <div className="run-evaluation-item">
                <span className="run-evaluation-label">Failure Criteria</span>
                <span className={`run-evaluation-value ${criteria.failureMet ? "triggered" : "not-triggered"}`}>
                  {criteria.failureMet ? "Triggered" : "Not Triggered"}
                </span>
              </div>
            )}
            {criteria.maxMessagesReached && (
              <div className="run-evaluation-item full-width">
                <span className="run-evaluation-warning">Max messages limit reached</span>
              </div>
            )}
          </div>
        </div>
      )}

      {hasEvaluators && (
        <>
          <div className="evaluator-results-divider" />
          <div className="evaluator-results-table">
            {assertions.map((r) => (
              <div key={r.type} className={`evaluator-result-row ${r.success ? "passed" : "failed"}`}>
                <span className="evaluator-result-label">{r.label}</span>
                <span className={`evaluator-result-status ${r.success ? "passed" : "failed"}`}>
                  {r.success ? "Pass" : "Fail"}
                </span>
                {r.value !== undefined && (
                  <span className="evaluator-result-score">
                    {Math.round(r.value * 100)}%
                  </span>
                )}
                <span className="evaluator-result-reason">{r.reason}</span>
              </div>
            ))}
            {metricResults.map((r) => (
              <div key={r.type} className="evaluator-result-row metric">
                <span className="evaluator-result-label">{r.label}</span>
                <span className="evaluator-result-value">
                  {metrics?.[r.type] ?? r.value ?? "—"}
                </span>
                <span className="evaluator-result-reason">{r.reason}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
