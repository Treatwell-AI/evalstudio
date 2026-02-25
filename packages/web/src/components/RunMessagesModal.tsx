import { usePollingRun } from "../hooks/useRuns";
import { useConnectors } from "../hooks/useConnectors";
import { useScenarios } from "../hooks/useScenarios";
import { MessagesDisplay, SimulationError } from "./MessagesDisplay";
import { RunStatusIndicator } from "./RunStatusIndicator";
import { EvaluatorResults } from "./EvaluatorResults";

interface RunMessagesModalProps {
  runId: string;
  onClose: () => void;
}

export function RunMessagesModal({ runId, onClose }: RunMessagesModalProps) {
  const { run, isLoading } = usePollingRun(runId);
  const { data: connectors } = useConnectors();
  const { data: scenarios } = useScenarios();

  const connectorName = run?.connectorId
    ? connectors?.find((c) => c.id === run.connectorId)?.name
    : undefined;
  const scenarioName = run?.scenarioId
    ? scenarios?.find((s) => s.id === run.scenarioId)?.name
    : undefined;

  const titleParts: string[] = [];
  if (run?.executionId != null) titleParts.push(`Evaluation #${run.executionId}`);
  if (connectorName) titleParts.push(connectorName);
  if (scenarioName) titleParts.push(scenarioName);
  const title = titleParts.join(" · ") || "Run Messages";

  if (isLoading || !run) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal run-preview-modal" onClick={(e) => e.stopPropagation()}>
          <h3 className="modal-title-ellipsis">Loading...</h3>
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
        <h3 className="modal-title-ellipsis" title={title}>{title}</h3>

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
