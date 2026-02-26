import { useState, useEffect } from "react";
import {
  useEval,
  useCreateEval,
  useUpdateEval,
} from "../hooks/useEvals";
import { useScenarios } from "../hooks/useScenarios";
import { useConnectors } from "../hooks/useConnectors";

interface EvalFormProps {
  evalId: string | null;
  onClose: (createdId?: string) => void;
}

export function EvalForm({ evalId, onClose }: EvalFormProps) {
  const [name, setName] = useState("");
  const [scenarioIds, setScenarioIds] = useState<string[]>([]);
  const [connectorId, setConnectorId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [scenarioSearch, setScenarioSearch] = useState("");

  const { data: evalItem } = useEval(evalId);
  const { data: scenarios } = useScenarios();
  const { data: connectors } = useConnectors();
  const createEval = useCreateEval();
  const updateEval = useUpdateEval();

  const isEditing = !!evalId;
  const isPending = createEval.isPending || updateEval.isPending;

  useEffect(() => {
    if (evalItem) {
      setName(evalItem.name || "");
      setScenarioIds(evalItem.scenarioIds || []);
      setConnectorId(evalItem.connectorId || "");
    }
  }, [evalItem]);

  const handleScenarioToggle = (scenarioId: string) => {
    setScenarioIds((prev) =>
      prev.includes(scenarioId)
        ? prev.filter((id) => id !== scenarioId)
        : [...prev, scenarioId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    if (scenarioIds.length === 0) {
      setError("At least one scenario is required");
      return;
    }

    if (!connectorId) {
      setError("Connector is required");
      return;
    }

    try {
      if (isEditing && evalId) {
        await updateEval.mutateAsync({
          id: evalId,
          input: {
            name: name.trim(),
            scenarioIds,
            connectorId,
          },
        });
      } else {
        const created = await createEval.mutateAsync({
          name: name.trim(),
          scenarioIds,
          connectorId,
        });
        onClose(created.id);
        return;
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  return (
    <div className="modal-overlay" onClick={() => onClose()}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{isEditing ? "Edit Eval" : "Create Eval"}</h3>

        <form onSubmit={handleSubmit}>
          {error && <div className="form-error">{error}</div>}

          <div className="form-group">
            <label htmlFor="eval-name">Name *</label>
            <input
              type="text"
              id="eval-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter eval name"
              required
            />
          </div>

          <div className="form-group">
            <label>Scenarios * ({scenarioIds.length} selected)</label>
            {(scenarios?.length ?? 0) > 5 && (
              <input
                type="text"
                className="scenario-search-input"
                placeholder="Search scenarios..."
                value={scenarioSearch}
                onChange={(e) => setScenarioSearch(e.target.value)}
              />
            )}
            <div className="checkbox-list scenario-checkbox-list">
              {scenarios
                ?.filter((scenario) =>
                  scenario.name.toLowerCase().includes(scenarioSearch.toLowerCase())
                )
                .map((scenario) => (
                  <label key={scenario.id} className="checkbox-item checkbox-item-compact">
                    <input
                      type="checkbox"
                      checked={scenarioIds.includes(scenario.id)}
                      onChange={() => handleScenarioToggle(scenario.id)}
                    />
                    <span>{scenario.name}</span>
                  </label>
                ))}
              {(!scenarios || scenarios.length === 0) && (
                <p className="form-hint">No scenarios available. Create a scenario first.</p>
              )}
              {(scenarios?.length ?? 0) > 0 &&
                scenarios?.filter((scenario) =>
                  scenario.name.toLowerCase().includes(scenarioSearch.toLowerCase())
                ).length === 0 && (
                  <p className="form-hint">No scenarios match "{scenarioSearch}"</p>
                )}
            </div>
            <small className="form-hint">
              Select one or more scenarios. Each scenario defines a test context with its own personas.
              Runs will be created for each scenario/persona combination.
            </small>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="eval-connector">Connector *</label>
              <select
                id="eval-connector"
                value={connectorId}
                onChange={(e) => setConnectorId(e.target.value)}
                required
              >
                <option value="">-- Select Connector --</option>
                {connectors?.map((connector) => (
                  <option key={connector.id} value={connector.id}>
                    {connector.name} ({connector.type})
                  </option>
                ))}
              </select>
              <small className="form-hint">
                The connector defines how to communicate with the agent being tested
              </small>
            </div>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => onClose()}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isPending}
            >
              {isPending ? "Saving..." : isEditing ? "Save" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
