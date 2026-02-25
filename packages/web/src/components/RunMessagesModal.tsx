import { usePollingRun } from "../hooks/useRuns";
import { MessagesDisplay, SimulationError } from "./MessagesDisplay";
import { RunStatusIndicator } from "./RunStatusIndicator";
import { EvaluatorResults } from "./EvaluatorResults";

interface RunMessagesModalProps {
  runId: string;
  onClose: () => void;
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
        <h3>Run Messages{run.executionId != null ? ` — Execution #${run.executionId}` : ""}</h3>

        <MessagesDisplay
          messages={run.messages}
          additionalContent={additionalContent}
          footer={<EvaluatorResults run={run} />}
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
