import { Run, EvaluatorResultEntry } from "../lib/api";
import { usePollingRun } from "../hooks/useRuns";
import { MessagesDisplay, SimulationError } from "./MessagesDisplay";
import { RunStatusIndicator } from "./RunStatusIndicator";

interface RunMessagesModalProps {
  runId: string;
  onClose: () => void;
}

/** Extract LLM criteria result from run output */
function getCriteriaResult(run: Run) {
  const output = run.output as Record<string, unknown> | undefined;
  if (!output) return null;

  const evaluation = output.evaluation as Record<string, unknown> | undefined;
  if (!evaluation) return null;

  return {
    successMet: evaluation.successMet as boolean | undefined,
    failureMet: evaluation.failureMet as boolean | undefined,
    confidence: evaluation.confidence as number | undefined,
    reasoning: evaluation.reasoning as string | undefined,
    messageCount: output.messageCount as number | undefined,
    avgLatencyMs: output.avgLatencyMs as number | undefined,
    maxMessagesReached: output.maxMessagesReached as boolean | undefined,
  };
}

export function RunMessagesModal({ runId, onClose }: RunMessagesModalProps) {
  const { run, isLoading } = usePollingRun(runId);

  if (isLoading || !run) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal run-preview-modal" onClick={(e) => e.stopPropagation()}>
          <h3>Run Messages</h3>
          <div className="loading">Loading run...</div>
          <div className="form-actions">
            <button className="btn btn-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Extract evaluator data from run output
  const output = run.output as Record<string, unknown> | undefined;
  const evaluatorResults = output?.evaluatorResults as EvaluatorResultEntry[] | undefined;
  const outputMetrics = output?.metrics as Record<string, number> | undefined;

  // Additional content for status indicators
  const additionalContent = (
    <>
      <RunStatusIndicator run={run} messageCount={run.messages.length} />

      {/* Show error if any */}
      {run.status === "error" && run.error && (
        <SimulationError error={run.error} />
      )}
    </>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal run-preview-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Run Messages</h3>

        <MessagesDisplay
          messages={run.messages}
          additionalContent={additionalContent}
          result={run.status === "completed" ? run.result : undefined}
          criteriaResult={run.status === "completed" ? getCriteriaResult(run) : undefined}
          evaluatorResults={run.status === "completed" ? evaluatorResults : undefined}
          evaluatorMetrics={run.status === "completed" ? outputMetrics : undefined}
          emptyMessage="No messages in this run."
        />

        <div className="form-actions">
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
