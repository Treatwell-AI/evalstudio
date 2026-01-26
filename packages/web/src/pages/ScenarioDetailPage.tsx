import { useState, useEffect } from "react";
import { Link, useParams, useOutletContext, useNavigate } from "react-router-dom";
import { useScenario, useUpdateScenario, useDeleteScenario } from "../hooks/useScenarios";
import { usePersonas } from "../hooks/usePersonas";
import { useRunsByScenario } from "../hooks/useRuns";
import { Project, Message } from "../lib/api";
import { ScenarioPlaygroundModal } from "../components/ScenarioPlaygroundModal";
import { RunList } from "../components/RunList";
import { ScenarioCodeSnippets } from "../components/ScenarioCodeSnippets";
import { PerformanceChart } from "../components/PerformanceChart";

type ScenarioTab = "runs" | "code";
type ViewMode = "time" | "execution";

interface ProjectContext {
  project: Project;
}

export function ScenarioDetailPage() {
  const navigate = useNavigate();
  const { project } = useOutletContext<ProjectContext>();
  const { scenarioId } = useParams<{ scenarioId: string }>();
  const { data: scenario, isLoading, error } = useScenario(scenarioId ?? null);
  const { data: personas = [] } = usePersonas(project.id);
  const updateScenario = useUpdateScenario();
  const deleteScenario = useDeleteScenario();

  // Load runs for performance chart
  const { data: runs = [] } = useRunsByScenario(scenarioId ?? "");
  const [showMenu, setShowMenu] = useState(false);
  const [showPlayground, setShowPlayground] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [activeTab, setActiveTab] = useState<ScenarioTab>("runs");
  const [viewMode, setViewMode] = useState<ViewMode>("time");

  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [messagesJson, setMessagesJson] = useState("[]");
  const [maxMessages, setMaxMessages] = useState("");
  const [successCriteria, setSuccessCriteria] = useState("");
  const [failureCriteria, setFailureCriteria] = useState("");
  const [failureCriteriaMode, setFailureCriteriaMode] = useState<"every_turn" | "on_max_messages">("on_max_messages");
  const [selectedPersonaIds, setSelectedPersonaIds] = useState<string[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Load scenario data into form when it changes
  useEffect(() => {
    if (scenario) {
      setName(scenario.name);
      setInstructions(scenario.instructions || "");
      setMessagesJson(scenario.messages ? JSON.stringify(scenario.messages, null, 2) : "[]");
      setMaxMessages(scenario.maxMessages?.toString() || "");
      setSuccessCriteria(scenario.successCriteria || "");
      setFailureCriteria(scenario.failureCriteria || "");
      setFailureCriteriaMode(scenario.failureCriteriaMode || "on_max_messages");
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
        <Link to={`/project/${project.id}/scenarios`} className="btn btn-secondary">
          Back to Scenarios
        </Link>
      </div>
    );
  }

  const handleDelete = async () => {
    setShowMenu(false);
    if (confirm(`Delete scenario "${scenario.name}"?`)) {
      await deleteScenario.mutateAsync(scenario.id);
      navigate(`/project/${project.id}/scenarios`);
    }
  };

  const handleSave = async () => {
    setSaveError(null);
    if (!name.trim()) {
      setSaveError("Name is required");
      return;
    }

    let messages: Message[] | undefined;
    try {
      const parsed = JSON.parse(messagesJson);
      if (Array.isArray(parsed)) {
        messages = parsed;
      }
    } catch {
      setSaveError("Invalid JSON in messages field");
      return;
    }

    try {
      await updateScenario.mutateAsync({
        id: scenario.id,
        input: {
          name,
          instructions: instructions || undefined,
          messages,
          maxMessages: maxMessages ? parseInt(maxMessages, 10) : undefined,
          successCriteria: successCriteria || undefined,
          failureCriteria: failureCriteria || undefined,
          failureCriteriaMode,
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
    setMessagesJson(scenario.messages ? JSON.stringify(scenario.messages, null, 2) : "[]");
    setMaxMessages(scenario.maxMessages?.toString() || "");
    setSuccessCriteria(scenario.successCriteria || "");
    setFailureCriteria(scenario.failureCriteria || "");
    setFailureCriteriaMode(scenario.failureCriteriaMode || "on_max_messages");
    setSelectedPersonaIds(scenario.personaIds || []);
    setSaveError(null);
    setHasChanges(false);
  };

  return (
    <div className="page scenario-detail-page">
      <div className="page-header">
        <div className="page-header-nav">
          <Link
            to={`/project/${project.id}/scenarios`}
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

        <div className="form-group">
          <label htmlFor="scenario-messages">
            Initial Messages (JSON array, optional)
          </label>
          <p className="form-hint">
            Seed the conversation with prior messages. Format: {`[{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]`}
          </p>
          <textarea
            id="scenario-messages"
            value={messagesJson}
            onChange={(e) => handleChange(setMessagesJson)(e.target.value)}
            rows={6}
            className="code-textarea"
            placeholder='[{"role": "user", "content": "Hello"}, {"role": "assistant", "content": "Hi there!"}]'
          />
        </div>
      </div>

      <div className="dashboard-card scenario-edit-form">
        <h3>Evaluation Criteria</h3>

        <div className="form-group">
          <label htmlFor="scenario-success">Success Criteria</label>
          <textarea
            id="scenario-success"
            value={successCriteria}
            onChange={(e) => handleChange(setSuccessCriteria)(e.target.value)}
            placeholder="The agent successfully processes the request and confirms with the customer"
            rows={2}
          />
          <p className="form-hint">Checked at every turn. The run stops and passes when met.</p>
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
        </div>

        <div className="form-row form-row-auto">
          <div className="form-group">
            <label htmlFor="scenario-failure-mode">Failure Check Mode</label>
            <select
              id="scenario-failure-mode"
              value={failureCriteriaMode}
              onChange={(e) => handleChange(setFailureCriteriaMode)(e.target.value as "every_turn" | "on_max_messages")}
              disabled={!failureCriteria}
            >
              <option value="on_max_messages">On max messages — only at end</option>
              <option value="every_turn">Every turn — stop on failure</option>
            </select>
          </div>
          <div className="form-group form-group-narrow">
            <label htmlFor="scenario-max-messages">Max Messages</label>
            <input
              id="scenario-max-messages"
              type="number"
              value={maxMessages}
              onChange={(e) => handleChange(setMaxMessages)(e.target.value)}
              placeholder="10"
              min="1"
            />
          </div>
        </div>

        <p className="form-hint criteria-recap">
          {failureCriteriaMode === "every_turn"
            ? `The run stops as soon as success or failure criteria is met${maxMessages ? `, or after ${maxMessages} messages` : ""}.`
            : maxMessages
              ? `The run stops when success criteria is met. After ${maxMessages} messages, failure criteria is checked.`
              : "The run stops when success criteria is met. At max messages, failure criteria is checked."}
        </p>
      </div>

      <div className="dashboard-card scenario-edit-form">
        <h3>Personas</h3>
        <p className="form-hint">
          Select personas to associate with this scenario. When running evals, these personas will be used to simulate different user types.
        </p>
        {personas.length === 0 ? (
          <p className="form-hint">
            No personas available.{" "}
            <Link to={`/project/${project.id}/personas`}>Create a persona</Link> first.
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
          <RunList scenarioId={scenario.id} projectId={project.id} />
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
