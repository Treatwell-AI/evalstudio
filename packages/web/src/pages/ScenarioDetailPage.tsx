import { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useScenario, useUpdateScenario, useDeleteScenario } from "../hooks/useScenarios";
import { usePersonas } from "../hooks/usePersonas";
import { useRunsByScenario } from "../hooks/useRuns";
import { Message, ScenarioEvaluator, projectImageUrl } from "../lib/api";
import { useProjectId } from "../hooks/useProjectId";
import { ScenarioPlaygroundModal } from "../components/ScenarioPlaygroundModal";
import { SeedMessagesEditor } from "../components/SeedMessagesEditor";
import { EvaluatorForm } from "../components/EvaluatorForm";
import { RunList } from "../components/RunList";
import { ScenarioCodeSnippets } from "../components/ScenarioCodeSnippets";
import { PerformanceChart } from "../components/PerformanceChart";

type ScenarioTab = "settings" | "stats" | "code";

export function ScenarioDetailPage() {
  const navigate = useNavigate();
  const projectId = useProjectId();
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
  const [activeTab, setActiveTabState] = useState<ScenarioTab>(
    () => (localStorage.getItem("scenarioTab") as ScenarioTab) || "settings"
  );
  const setActiveTab = (tab: ScenarioTab) => {
    setActiveTabState(tab);
    localStorage.setItem("scenarioTab", tab);
  };
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
    <div className="page page-detail scenario-detail-page">
      <div className="page-header">
        <div className="page-header-nav">
          <Link to=".." relative="path" className="back-btn" title="Back to Scenarios">
            <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 12L6 8l4-4" />
            </svg>
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

      <div className="page-body">
      {saveError && <div className="form-error">{saveError}</div>}

      <div className="scenario-detail-tabs">
        <div className="scenario-tabs-header">
          <div className="scenario-tabs-nav">
            <button
              className={`scenario-tab ${activeTab === "settings" ? "active" : ""}`}
              onClick={() => setActiveTab("settings")}
            >
              Settings
            </button>
            <button
              className={`scenario-tab ${activeTab === "stats" ? "active" : ""}`}
              onClick={() => setActiveTab("stats")}
            >
              Stats
            </button>
            <button
              className={`scenario-tab ${activeTab === "code" ? "active" : ""}`}
              onClick={() => setActiveTab("code")}
            >
              Code
            </button>
          </div>
        </div>

        {activeTab === "settings" && (
          <>
            <div className="dashboard-card scenario-edit-form">
              <div className="form-group">
                <label htmlFor="scenario-instructions">📄 Instructions</label>
                <span className="form-hint">Describe using natural language the situation the user is facing.</span>
                <textarea
                  id="scenario-instructions"
                  value={instructions}
                  onChange={(e) => handleChange(setInstructions)(e.target.value)}
                  rows={4}
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
              <div className="form-group">
                <div className="form-label-row">
                  <label htmlFor="scenario-success">✅ Success Criteria</label>
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
                <label htmlFor="scenario-failure">❌ Failure Criteria</label>
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
              <div className="form-group">
                <div className="form-label-row">
                  <label>Personas ({selectedPersonaIds.length} selected)</label>
                  <span className="form-hint">Select personas to test this scenario with different user profiles.</span>
                </div>
                {personas.length === 0 ? (
                  <p className="form-hint">
                    No personas available.{" "}
                    <Link to="../../personas" relative="path">Create a persona</Link> first.
                  </p>
                ) : (
                  <div className="persona-checkbox-list">
                    {personas.map((persona) => (
                      <label key={persona.id} className="persona-row persona-row-selectable">
                        <input
                          type="checkbox"
                          checked={selectedPersonaIds.includes(persona.id)}
                          onChange={() => handlePersonaToggle(persona.id)}
                        />
                        <div className="persona-avatar-sm">
                          {persona.imageUrl ? (
                            <img
                              src={`${projectImageUrl(projectId, persona.imageUrl)}?t=${persona.updatedAt}`}
                              alt={persona.name}
                            />
                          ) : (
                            <span>{persona.name.charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                        <span className="persona-name">{persona.name}</span>
                        {persona.description && (
                          <span className="persona-description">{persona.description}</span>
                        )}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="dashboard-card scenario-edit-form">
              <EvaluatorForm
                evaluators={evaluators}
                onChange={handleChange(setEvaluators)}
              />
            </div>
          </>
        )}

        {activeTab === "stats" && (
          <>
            <h3 className="section-label">Trends</h3>
            <PerformanceChart runs={runs} />
            <h3 className="section-label">Recent Runs</h3>
            <RunList scenarioId={scenario.id} />
          </>
        )}

        {activeTab === "code" && (
          <ScenarioCodeSnippets scenario={scenario} />
        )}
      </div>

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
