import { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useScenario, useUpdateScenario, useDeleteScenario } from "../hooks/useScenarios";
import { usePersonas } from "../hooks/usePersonas";
import { useRunsByScenario } from "../hooks/useRuns";
import { Message, ScenarioEvaluator } from "../lib/api";
import { ScenarioPlaygroundModal } from "../components/ScenarioPlaygroundModal";
import { SeedMessagesEditor } from "../components/SeedMessagesEditor";
import { EvaluatorForm } from "../components/EvaluatorForm";
import { RunList } from "../components/RunList";
import { ScenarioCodeSnippets } from "../components/ScenarioCodeSnippets";
import { PerformanceChart } from "../components/PerformanceChart";

type ScenarioTab = "runs" | "code";
type ViewMode = "time" | "execution";

export function ScenarioDetailPage() {
  const navigate = useNavigate();
  const { scenarioId } = useParams<{ scenarioId: string }>();
  const { data: scenario, isLoading, error } = useScenario(scenarioId ?? null);
  const { data: personas = [] } = usePersonas();
  const updateScenario = useUpdateScenario();
  const deleteScenario = useDeleteScenario();

  // Load runs for performance chart
  const { data: runs = [] } = useRunsByScenario(scenarioId ?? "");
  const [showMenu, setShowMenu] = useState(false);
  const [showPlayground, setShowPlayground] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [activeTab, setActiveTab] = useState<ScenarioTab>("runs");
  const [viewMode, setViewMode] = useState<ViewMode>("execution");

  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [seedMessages, setSeedMessages] = useState<Message[]>([]);
  const [maxMessages, setMaxMessages] = useState("");
  const [successCriteria, setSuccessCriteria] = useState("");
  const [failureCriteria, setFailureCriteria] = useState("");
  const [failureCriteriaMode, setFailureCriteriaMode] = useState<"every_turn" | "on_max_messages">("on_max_messages");
  const [evaluators, setEvaluators] = useState<ScenarioEvaluator[]>([]);
  const [selectedPersonaIds, setSelectedPersonaIds] = useState<string[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Load scenario data into form when it changes
  useEffect(() => {
    if (scenario) {
      setName(scenario.name);
      setInstructions(scenario.instructions || "");
      setSeedMessages(scenario.messages || []);
      setMaxMessages(scenario.maxMessages?.toString() || "");
      setSuccessCriteria(scenario.successCriteria || "");
      setFailureCriteria(scenario.failureCriteria || "");
      setFailureCriteriaMode(scenario.failureCriteriaMode || "on_max_messages");
      setEvaluators(scenario.evaluators || []);
      setSelectedPersonaIds(scenario.personaIds || []);
      setHasChanges(false);
    }
  }, [scenario]);

  // Track changes
  const handleChange = <T,>(setter: React.Dispatch<React.SetStateAction<T>>) => {
    return (value: T) => {
      setter(value);
      setHasChanges(true);
    };
  };

  if (isLoading) {
    return <div className="loading">Loading scenario...</div>;
  }

  if (error || !scenario) {
    return (
      <div className="page">
        <div className="error">
          {error instanceof Error ? error.message : "Scenario not found"}
        </div>
        <Link to=".." relative="path" className="btn btn-secondary">
          Back to Scenarios
        </Link>
      </div>
    );
  }

  const handleDelete = async () => {
    setShowMenu(false);
    if (confirm(`Delete scenario "${scenario.name}"?`)) {
      await deleteScenario.mutateAsync(scenario.id);
      navigate("..", { relative: "path" });
    }
  };

  const handleSave = async () => {
    setSaveError(null);
    if (!name.trim()) {
      setSaveError("Name is required");
      return;
    }

    try {
      await updateScenario.mutateAsync({
        id: scenario.id,
        input: {
          name,
          instructions: instructions || undefined,
          messages: seedMessages.length > 0 ? seedMessages : undefined,
          maxMessages: maxMessages ? parseInt(maxMessages, 10) : undefined,
          successCriteria: successCriteria || undefined,
          failureCriteria: failureCriteria || undefined,
          failureCriteriaMode,
          evaluators,
          personaIds: selectedPersonaIds,
        },
      });
      setHasChanges(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  const handlePersonaToggle = (personaId: string) => {
    setSelectedPersonaIds((prev) => {
      const newIds = prev.includes(personaId)
        ? prev.filter((id) => id !== personaId)
        : [...prev, personaId];
      setHasChanges(true);
      return newIds;
    });
  };

  const handleCancel = () => {
    // Reset to original values
    setName(scenario.name);
    setInstructions(scenario.instructions || "");
    setSeedMessages(scenario.messages || []);
    setMaxMessages(scenario.maxMessages?.toString() || "");
    setSuccessCriteria(scenario.successCriteria || "");
    setFailureCriteria(scenario.failureCriteria || "");
    setFailureCriteriaMode(scenario.failureCriteriaMode || "on_max_messages");
    setEvaluators(scenario.evaluators || []);
    setSelectedPersonaIds(scenario.personaIds || []);
    setSaveError(null);
    setHasChanges(false);
  };

  return (
    <div className="page scenario-detail-page">
      <div className="page-header">
        <div className="page-header-nav">
          <Link
            to=".."
            relative="path"
            className="back-link"
          >
            ← Back to Scenarios
          </Link>
          {isEditingTitle ? (
            <input
              type="text"
              value={name}
              onChange={(e) => handleChange(setName)(e.target.value)}
              onBlur={() => setIsEditingTitle(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setIsEditingTitle(false);
                if (e.key === "Escape") {
                  setName(scenario.name);
                  setIsEditingTitle(false);
                }
              }}
              className="editable-title-input"
              style={{ width: `${Math.max(name.length, 1) + 2}ch` }}
              autoFocus
            />
          ) : (
            <h1
              className="editable-title"
              onClick={() => setIsEditingTitle(true)}
              title="Click to edit"
            >
              {name || scenario.name}
            </h1>
          )}
        </div>
        <div className="page-header-actions">
          <button
            className="btn btn-success"
            onClick={() => setShowPlayground(true)}
          >
            <span className="play-icon">▶</span> Playground
          </button>
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
                disabled={updateScenario.isPending}
              >
                {updateScenario.isPending ? "Saving..." : "Save"}
              </button>
            </>
          )}
          <div className="menu-container">
            <button
              className="menu-btn"
              onClick={() => setShowMenu(!showMenu)}
              aria-label="Scenario actions"
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
                    disabled={deleteScenario.isPending}
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

      <div className="dashboard-card scenario-edit-form">
        <h3>Scenario Setup</h3>

        <div className="form-group">
          <label htmlFor="scenario-instructions">Instructions</label>
          <textarea
            id="scenario-instructions"
            value={instructions}
            onChange={(e) => handleChange(setInstructions)(e.target.value)}
            rows={6}
            placeholder="Provide all context for this scenario: what the customer issue is, why they're contacting support, any background information needed..."
          />
        </div>

        <SeedMessagesEditor
          messages={seedMessages}
          onChange={handleChange(setSeedMessages)}
        />

        <div className="form-inline-field">
          <label htmlFor="scenario-max-messages">Max Messages</label>
          <input
            id="scenario-max-messages"
            type="number"
            value={maxMessages}
            onChange={(e) => handleChange(setMaxMessages)(e.target.value)}
            placeholder="10"
            min="1"
          />
          <span className="form-hint">Maximum conversation turns before the run stops.</span>
        </div>
      </div>

      <div className="dashboard-card scenario-edit-form">
        <h3>Evaluation Criteria</h3>

        <div className="form-group">
          <div className="form-label-row">
            <label htmlFor="scenario-success">Success Criteria</label>
            <span className="form-hint">Checked at every turn. The run stops and passes when met.</span>
          </div>
          <textarea
            id="scenario-success"
            value={successCriteria}
            onChange={(e) => handleChange(setSuccessCriteria)(e.target.value)}
            placeholder="The agent successfully processes the request and confirms with the customer"
            rows={2}
          />
        </div>

        <div className="form-group">
          <label htmlFor="scenario-failure">Failure Criteria</label>
          <textarea
            id="scenario-failure"
            value={failureCriteria}
            onChange={(e) => handleChange(setFailureCriteria)(e.target.value)}
            placeholder="The agent fails to understand the request or provides incorrect information"
            rows={2}
          />
          <div className="form-label-row">
            <select
              id="scenario-failure-mode"
              className="form-label-row-select"
              value={failureCriteriaMode}
              onChange={(e) => handleChange(setFailureCriteriaMode)(e.target.value as "every_turn" | "on_max_messages")}
              disabled={!failureCriteria}
            >
              <option value="on_max_messages">Check Failure on max messages — only at end</option>
              <option value="every_turn">Check Failure every turn — stop on failure</option>
            </select>
            <span className="form-hint">
              {failureCriteriaMode === "every_turn"
                ? `The run stops as soon as success or failure criteria is met${maxMessages ? `, or after ${maxMessages} messages` : ""}.`
                : maxMessages
                  ? `The run stops when success criteria is met. After ${maxMessages} messages, failure criteria is checked.`
                  : "The run stops when success criteria is met. At max messages, failure criteria is checked."}
            </span>
          </div>
        </div>
      </div>

      <div className="dashboard-card scenario-edit-form">
        <h3>Evaluators</h3>
        <p className="form-hint">
          Add metrics or assertions that run alongside LLM-as-judge evaluation.
        </p>
        <EvaluatorForm
          evaluators={evaluators}
          onChange={handleChange(setEvaluators)}
        />
      </div>

      <div className="dashboard-card scenario-edit-form">
        <h3>Personas</h3>
        <p className="form-hint">
          Select personas to associate with this scenario. When running evals, these personas will be used to simulate different user types.
        </p>
        {personas.length === 0 ? (
          <p className="form-hint">
            No personas available.{" "}
            <Link to="../../personas" relative="path">Create a persona</Link> first.
          </p>
        ) : (
          <div className="persona-checkbox-list">
            {personas.map((persona) => (
              <label key={persona.id} className="checkbox-item">
                <input
                  type="checkbox"
                  checked={selectedPersonaIds.includes(persona.id)}
                  onChange={() => handlePersonaToggle(persona.id)}
                />
                <span className="checkbox-label">
                  <span className="checkbox-name">{persona.name}</span>
                  {persona.description && (
                    <span className="checkbox-description">{persona.description}</span>
                  )}
                </span>
              </label>
            ))}
          </div>
        )}
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

      <div className="scenario-detail-tabs">
        <div className="scenario-tabs-header">
          <div className="scenario-tabs-nav">
            <button
              className={`scenario-tab ${activeTab === "runs" ? "active" : ""}`}
              onClick={() => setActiveTab("runs")}
            >
              Runs
            </button>
            <button
              className={`scenario-tab ${activeTab === "code" ? "active" : ""}`}
              onClick={() => setActiveTab("code")}
            >
              Code
            </button>
          </div>
        </div>

        {activeTab === "runs" && (
          <RunList scenarioId={scenario.id} />
        )}

        {activeTab === "code" && (
          <ScenarioCodeSnippets scenario={scenario} />
        )}
      </div>

      {showPlayground && (
        <ScenarioPlaygroundModal
          scenario={scenario}
          personas={personas}
          onClose={() => setShowPlayground(false)}
        />
      )}
    </div>
  );
}
