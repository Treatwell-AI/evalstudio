import { useState, useEffect } from "react";
import { Link, useParams, useOutletContext, useNavigate } from "react-router-dom";
import { usePersona, useUpdatePersona, useDeletePersona } from "../hooks/usePersonas";
import { useRunsByPersona } from "../hooks/useRuns";
import { Project } from "../lib/api";
import { RunList } from "../components/RunList";
import { PersonaCodeSnippets } from "../components/PersonaCodeSnippets";
import { PerformanceChart } from "../components/PerformanceChart";

type PersonaTab = "runs" | "code";
type ViewMode = "time" | "execution";

interface ProjectContext {
  project: Project;
}

export function PersonaDetailPage() {
  const navigate = useNavigate();
  const { project } = useOutletContext<ProjectContext>();
  const { personaId } = useParams<{ personaId: string }>();
  const { data: persona, isLoading, error } = usePersona(personaId ?? null);
  const updatePersona = useUpdatePersona();
  const deletePersona = useDeletePersona();

  // Load runs for performance chart
  const { data: runs = [] } = useRunsByPersona(personaId ?? "");
  const [showMenu, setShowMenu] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [activeTab, setActiveTab] = useState<PersonaTab>("runs");
  const [viewMode, setViewMode] = useState<ViewMode>("time");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Load persona data into form when it changes
  useEffect(() => {
    if (persona) {
      setName(persona.name);
      setDescription(persona.description || "");
      setSystemPrompt(persona.systemPrompt || "");
      setHasChanges(false);
    }
  }, [persona]);

  // Track changes
  const handleChange = <T,>(setter: React.Dispatch<React.SetStateAction<T>>) => {
    return (value: T) => {
      setter(value);
      setHasChanges(true);
    };
  };

  if (isLoading) {
    return <div className="loading">Loading persona...</div>;
  }

  if (error || !persona) {
    return (
      <div className="page">
        <div className="error">
          {error instanceof Error ? error.message : "Persona not found"}
        </div>
        <Link to={`/project/${project.id}/personas`} className="btn btn-secondary">
          Back to Personas
        </Link>
      </div>
    );
  }

  const handleDelete = async () => {
    setShowMenu(false);
    if (confirm(`Delete persona "${persona.name}"?`)) {
      await deletePersona.mutateAsync(persona.id);
      navigate(`/project/${project.id}/personas`);
    }
  };

  const handleSave = async () => {
    setSaveError(null);
    if (!name.trim()) {
      setSaveError("Name is required");
      return;
    }

    try {
      await updatePersona.mutateAsync({
        id: persona.id,
        input: {
          name,
          description: description || undefined,
          systemPrompt: systemPrompt || undefined,
        },
      });
      setHasChanges(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  const handleCancel = () => {
    // Reset to original values
    setName(persona.name);
    setDescription(persona.description || "");
    setSystemPrompt(persona.systemPrompt || "");
    setSaveError(null);
    setHasChanges(false);
  };

  return (
    <div className="page persona-detail-page">
      <div className="page-header">
        <div className="page-header-nav">
          <Link
            to={`/project/${project.id}/personas`}
            className="back-link"
          >
            ← Back to Personas
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
                  setName(persona.name);
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
              {name || persona.name}
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
                disabled={updatePersona.isPending}
              >
                {updatePersona.isPending ? "Saving..." : "Save"}
              </button>
            </>
          )}
          <div className="menu-container">
            <button
              className="menu-btn"
              onClick={() => setShowMenu(!showMenu)}
              aria-label="Persona actions"
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
                    disabled={deletePersona.isPending}
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

      <div className="persona-detail-content">
        <div className="persona-edit-form">
          <div className="form-group">
            <label htmlFor="persona-description">Description</label>
            <p className="form-hint">
              A brief description of this persona (shown in lists and dropdowns).
            </p>
            <input
              id="persona-description"
              type="text"
              value={description}
              onChange={(e) => handleChange(setDescription)(e.target.value)}
              placeholder="Impatient customer who wants quick answers"
            />
          </div>

          <div className="form-group">
            <label htmlFor="persona-system-prompt">System Prompt</label>
            <p className="form-hint">
              Full character instructions for the LLM. Describe personality, behavior patterns, communication style, and any specific traits this persona should exhibit.
            </p>
            <textarea
              id="persona-system-prompt"
              value={systemPrompt}
              onChange={(e) => handleChange(setSystemPrompt)(e.target.value)}
              rows={10}
              placeholder="You are an impatient customer who values their time. You tend to:
- Get frustrated with long explanations
- Ask direct questions and expect quick answers
- Express urgency in your messages
- Appreciate when issues are resolved efficiently"
            />
          </div>
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

      <div className="persona-detail-tabs">
        <div className="persona-tabs-header">
          <div className="persona-tabs-nav">
            <button
              className={`persona-tab ${activeTab === "runs" ? "active" : ""}`}
              onClick={() => setActiveTab("runs")}
            >
              Runs
            </button>
            <button
              className={`persona-tab ${activeTab === "code" ? "active" : ""}`}
              onClick={() => setActiveTab("code")}
            >
              Code
            </button>
          </div>
        </div>

        {activeTab === "runs" && (
          <RunList personaId={persona.id} projectId={project.id} />
        )}

        {activeTab === "code" && (
          <PersonaCodeSnippets persona={persona} />
        )}
      </div>
    </div>
  );
}
