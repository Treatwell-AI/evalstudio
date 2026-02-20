import { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useEval, useUpdateEval, useDeleteEval } from "../hooks/useEvals";
import { useScenarios } from "../hooks/useScenarios";
import { useConnectors } from "../hooks/useConnectors";
import { useRunsByEval } from "../hooks/useRuns";
import { RunList } from "../components/RunList";
import { CreateRunDialog } from "../components/CreateRunDialog";
import { EvalCodeSnippets } from "../components/EvalCodeSnippets";
import { PerformanceChart } from "../components/PerformanceChart";
import { EvalWithRelations } from "../lib/api";

type EvalTab = "runs" | "code";
type ViewMode = "time" | "execution";

export function EvalDetailPage() {
  const navigate = useNavigate();
  const { evalId } = useParams<{ evalId: string }>();
  const { data: evalItem, isLoading, error } = useEval(evalId ?? null, true);
  const updateEval = useUpdateEval();
  const deleteEval = useDeleteEval();
  const [showCreateRunDialog, setShowCreateRunDialog] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [activeTab, setActiveTab] = useState<EvalTab>("runs");
  const [viewMode, setViewMode] = useState<ViewMode>("execution");
  const [scenarioSearch, setScenarioSearch] = useState("");

  // Load related data for dropdowns
  const { data: scenarios = [] } = useScenarios();
  const { data: connectors = [] } = useConnectors();

  // Load runs for performance chart
  const { data: runs = [] } = useRunsByEval(evalId ?? "");

  // Form state
  const [name, setName] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [scenarioIds, setScenarioIds] = useState<string[]>([]);
  const [connectorId, setConnectorId] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Load eval data into form when it changes
  useEffect(() => {
    if (evalItem) {
      setName(evalItem.name);
      setScenarioIds(evalItem.scenarioIds || []);
      setConnectorId(evalItem.connectorId);
      setHasChanges(false);
    }
  }, [evalItem]);

  if (isLoading) {
    return <div className="loading">Loading eval...</div>;
  }

  if (error || !evalItem) {
    return (
      <div className="page">
        <div className="error">
          {error instanceof Error ? error.message : "Eval not found"}
        </div>
        <Link to=".." relative="path" className="btn btn-secondary">
          Back to Evals
        </Link>
      </div>
    );
  }

  const evalWithRelations = evalItem as EvalWithRelations;

  const getDisplayName = () => {
    return name || evalWithRelations.name || evalWithRelations.id;
  };

  const handleChange = <T,>(setter: React.Dispatch<React.SetStateAction<T>>) => {
    return (value: T) => {
      setter(value);
      setHasChanges(true);
    };
  };

  const handleDelete = async () => {
    setShowMenu(false);
    const displayName = getDisplayName();
    if (confirm(`Delete eval "${displayName}"? This will also delete all associated runs.`)) {
      await deleteEval.mutateAsync(evalWithRelations.id);
      navigate("..", { relative: "path" });
    }
  };

  const handleScenarioToggle = (scenarioId: string) => {
    setScenarioIds((prev) => {
      const newIds = prev.includes(scenarioId)
        ? prev.filter((id) => id !== scenarioId)
        : [...prev, scenarioId];
      setHasChanges(true);
      return newIds;
    });
  };

  const handleSave = async () => {
    setSaveError(null);

    if (scenarioIds.length === 0) {
      setSaveError("At least one scenario is required");
      return;
    }

    if (!connectorId) {
      setSaveError("Connector is required");
      return;
    }

    try {
      await updateEval.mutateAsync({
        id: evalWithRelations.id,
        input: {
          name,
          scenarioIds,
          connectorId,
        },
      });
      setHasChanges(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  const handleCancel = () => {
    // Reset to original values
    setName(evalItem.name);
    setScenarioIds(evalItem.scenarioIds || []);
    setConnectorId(evalItem.connectorId);
    setSaveError(null);
    setHasChanges(false);
  };

  // Get selected scenarios for displaying evaluation criteria
  const selectedScenarios = scenarios.filter(s => scenarioIds.includes(s.id));

  return (
    <div className="page eval-detail-page">
      <div className="page-header">
        <div className="page-header-nav">
          <Link
            to=".."
            relative="path"
            className="back-link"
          >
            ← Back to Evals
          </Link>
          {isEditingTitle ? (
            <input
              type="text"
              value={name || ""}
              onChange={(e) => handleChange(setName)(e.target.value)}
              onBlur={() => setIsEditingTitle(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setIsEditingTitle(false);
                if (e.key === "Escape") {
                  setName(evalItem.name);
                  setIsEditingTitle(false);
                }
              }}
              className="editable-title-input"
              style={{ width: `${Math.max((name || "").length, 1) + 2}ch` }}
              autoFocus
            />
          ) : (
            <h1 className="editable-title" onClick={() => setIsEditingTitle(true)} title="Click to edit">
              {getDisplayName()}
            </h1>
          )}
        </div>
        <div className="page-header-actions">
          {hasChanges && (
            <>
              <button
                className="btn btn-secondary"
                onClick={handleCancel}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={updateEval.isPending}
              >
                {updateEval.isPending ? "Saving..." : "Save"}
              </button>
            </>
          )}
          <button
            className="btn btn-primary"
            onClick={() => setShowCreateRunDialog(true)}
          >
            <span className="play-icon">▶</span> Run
          </button>
          <div className="menu-container">
            <button
              className="menu-btn"
              onClick={() => setShowMenu(!showMenu)}
              aria-label="Eval actions"
            >
              <span className="dots-icon">...</span>
            </button>
            {showMenu && (
              <>
                <div
                  className="menu-backdrop"
                  onClick={() => setShowMenu(false)}
                />
                <div className="menu-dropdown">
                  <button
                    className="menu-item menu-item-danger"
                    onClick={handleDelete}
                    disabled={deleteEval.isPending}
                  >
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {saveError && <div className="form-error">{saveError}</div>}

      <div className="eval-detail-settings">
        <div className="eval-edit-form eval-two-column">
          <div className="eval-primary-fields">
            <div className="form-group">
              <label>Scenarios ({scenarioIds.length} selected)</label>
              {scenarios.length > 5 && (
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
                  .filter((s) =>
                    s.name.toLowerCase().includes(scenarioSearch.toLowerCase())
                  )
                  .map((s) => (
                    <label key={s.id} className="checkbox-item checkbox-item-compact">
                      <input
                        type="checkbox"
                        checked={scenarioIds.includes(s.id)}
                        onChange={() => handleScenarioToggle(s.id)}
                      />
                      <span>{s.name}</span>
                    </label>
                  ))}
                {scenarios.length === 0 && (
                  <p className="form-hint">No scenarios available.</p>
                )}
                {scenarios.length > 0 &&
                  scenarios.filter((s) =>
                    s.name.toLowerCase().includes(scenarioSearch.toLowerCase())
                  ).length === 0 && (
                    <p className="form-hint">No scenarios match "{scenarioSearch}"</p>
                  )}
              </div>
              <small className="form-hint">
                Select one or more scenarios. Runs will be created for each scenario/persona combination.
              </small>
            </div>
          </div>

          <div className="eval-secondary-fields">
            <div className="form-group">
              <label htmlFor="eval-connector">Connector</label>
              <select
                id="eval-connector"
                value={connectorId}
                onChange={(e) => handleChange(setConnectorId)(e.target.value)}
              >
                <option value="">Select a connector...</option>
                {connectors.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

          </div>

          {selectedScenarios.length > 0 && selectedScenarios.some(s => s.maxMessages) && (
            <div className="eval-scenario-details">
              <div className="eval-detail-grid">
                {selectedScenarios.map((s) => s.maxMessages && (
                  <div key={s.id} className="eval-detail-field">
                    <label>{s.name} - Max Messages</label>
                    <div className="eval-detail-value">
                      {s.maxMessages}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="dashboard-card dashboard-card-wide">
        <div className="dashboard-card-header">
          <h3>Performance Overview</h3>
          {runs.some(r => r.executionId) && (
            <div className="performance-chart-toggle">
              <button
                className={`performance-chart-toggle-btn ${viewMode === "time" ? "active" : ""}`}
                onClick={() => setViewMode("time")}
              >
                By Time
              </button>
              <button
                className={`performance-chart-toggle-btn ${viewMode === "execution" ? "active" : ""}`}
                onClick={() => setViewMode("execution")}
              >
                By Execution
              </button>
            </div>
          )}
        </div>
        <PerformanceChart runs={runs} viewMode={viewMode} showToggle={false} />
      </div>

      <div className="eval-detail-tabs">
        <div className="eval-tabs-header">
          <div className="eval-tabs-nav">
            <button
              className={`eval-tab ${activeTab === "runs" ? "active" : ""}`}
              onClick={() => setActiveTab("runs")}
            >
              Runs
            </button>
            <button
              className={`eval-tab ${activeTab === "code" ? "active" : ""}`}
              onClick={() => setActiveTab("code")}
            >
              Code
            </button>
          </div>
        </div>

        {activeTab === "runs" && (
          <RunList evalId={evalWithRelations.id} />
        )}

        {activeTab === "code" && (
          <EvalCodeSnippets evalData={evalWithRelations} />
        )}
      </div>

      {showCreateRunDialog && (
        <CreateRunDialog
          evalId={evalWithRelations.id}
          onClose={() => setShowCreateRunDialog(false)}
        />
      )}
    </div>
  );
}
