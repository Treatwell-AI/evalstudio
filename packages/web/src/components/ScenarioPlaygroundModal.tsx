import { useState, useMemo } from "react";
import { Scenario, Persona, Message } from "../lib/api";
import { useScenarioPrompt } from "../hooks/useScenarios";
import { useConnectors } from "../hooks/useConnectors";
import { useCreatePlaygroundRun, usePollingRun } from "../hooks/useRuns";
import { MessagesDisplay, SimulationError } from "./MessagesDisplay";
import { RunStatusIndicator } from "./RunStatusIndicator";

interface ScenarioPlaygroundModalProps {
  scenario: Scenario;
  personas: Persona[];
  onClose: () => void;
}

export function ScenarioPlaygroundModal({
  scenario,
  personas,
  onClose,
}: ScenarioPlaygroundModalProps) {
  // Filter to only personas associated with this scenario
  const associatedPersonas = useMemo(() => {
    if (!scenario.personaIds || scenario.personaIds.length === 0) {
      return [];
    }
    return personas.filter((p) => scenario.personaIds?.includes(p.id));
  }, [scenario.personaIds, personas]);

  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(
    associatedPersonas.length > 0 ? associatedPersonas[0].id : null
  );
  const [selectedConnectorId, setSelectedConnectorId] = useState<string | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const { data: promptData, isLoading: promptLoading } = useScenarioPrompt(
    scenario.id,
    selectedPersonaId
  );
  const { data: connectors = [] } = useConnectors();
  const createPlaygroundRun = useCreatePlaygroundRun();

  // Poll for active run status
  const { run: activeRun } = usePollingRun(activeRunId);

  // Build the initial messages array (for display before run starts)
  const initialMessages = useMemo(() => {
    const messages: Message[] = [];

    // Messages from API (includes system prompt and scenario seed messages)
    if (promptData?.messages && promptData.messages.length > 0) {
      messages.push(...promptData.messages);
    }

    return messages;
  }, [promptData?.messages]);

  // Get messages to display - from run if active, otherwise initial messages
  const displayMessages = activeRun?.messages?.length ? activeRun.messages : initialMessages;

  const handleRun = async () => {
    if (!selectedConnectorId) return;

    setCreateError(null);

    try {
      const run = await createPlaygroundRun.mutateAsync({
        scenarioId: scenario.id,
        connectorId: selectedConnectorId,
        personaId: selectedPersonaId || undefined,
      });
      setActiveRunId(run.id);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create run");
    }
  };

  const handleReset = () => {
    setActiveRunId(null);
    setCreateError(null);
  };

  const isRunning = activeRun?.status === "queued" || activeRun?.status === "running";
  const isCompleted = activeRun?.status === "completed";

  // Determine which messages are new (added after run started)
  const newMessageCount = activeRun?.messages
    ? activeRun.messages.length - initialMessages.length
    : 0;

  const runContent = (
    <>
      {/* Show status indicator while running */}
      {activeRun && <RunStatusIndicator run={activeRun} messageCount={newMessageCount} />}

      {/* Show result when completed */}
      {isCompleted && activeRun?.result && (
        <div className={`run-result ${activeRun.result.success ? "success" : "failed"}`}>
          <strong>{activeRun.result.success ? "✓ Passed" : "✗ Failed"}</strong>
          {activeRun.result.reason && <p>{activeRun.result.reason}</p>}
          {activeRun.result.score !== undefined && (
            <span className="score">Score: {(activeRun.result.score * 100).toFixed(0)}%</span>
          )}
        </div>
      )}

      {/* Show error if any */}
      {activeRun?.status === "error" && activeRun.error && (
        <SimulationError error={activeRun.error} />
      )}
      {createError && (
        <SimulationError error={createError} />
      )}
    </>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal run-preview-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Scenario Playground</h3>

        {promptLoading ? (
          <div className="run-preview-content">
            <div className="loading">Loading prompt...</div>
          </div>
        ) : (
          <MessagesDisplay
            messages={displayMessages}
            additionalContent={runContent}
            emptyMessage="No messages configured for this scenario."
          />
        )}

        <div className="form-actions playground-actions">
          {associatedPersonas.length > 0 && (
            <select
              id="persona-select"
              className="playground-persona-select"
              value={selectedPersonaId || ""}
              onChange={(e) => setSelectedPersonaId(e.target.value || null)}
              disabled={isRunning}
            >
              <option value="">No persona</option>
              {associatedPersonas.map((persona) => (
                <option key={persona.id} value={persona.id}>
                  {persona.name}
                </option>
              ))}
            </select>
          )}

          <select
            id="connector-select"
            className="playground-connector-select"
            value={selectedConnectorId || ""}
            onChange={(e) => setSelectedConnectorId(e.target.value || null)}
            disabled={isRunning}
          >
            <option value="">Select connector...</option>
            {connectors.map((connector) => (
              <option key={connector.id} value={connector.id}>
                {connector.name}
              </option>
            ))}
          </select>

          {!activeRunId ? (
            <button
              className="btn btn-success"
              onClick={handleRun}
              disabled={!selectedConnectorId || createPlaygroundRun.isPending}
            >
              {createPlaygroundRun.isPending ? "Creating..." : "▶ Run"}
            </button>
          ) : isRunning ? (
            <button className="btn btn-secondary" disabled>
              Running...
            </button>
          ) : (
            <button className="btn btn-primary" onClick={handleReset}>
              New Run
            </button>
          )}

          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
