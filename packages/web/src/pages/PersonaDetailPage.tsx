import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { usePersona, usePersonas, useUpdatePersona, useDeletePersona, useGeneratePersonaImage, useCreatePersona } from "../hooks/usePersonas";
import { useRunsByPersona } from "../hooks/useRuns";
import { useLastVisited } from "../hooks/useLastVisited";
import { RunList } from "../components/RunList";
import { PersonaCodeSnippets } from "../components/PersonaCodeSnippets";
import { PerformanceChart } from "../components/PerformanceChart";
import { StyleguideModal } from "../components/StyleguideModal";
import { EntitySwitcher } from "../components/EntitySwitcher";
import { projectImageUrl } from "../lib/api";
import { useProjectId } from "../hooks/useProjectId";
import { HeadersEditor } from "../components/HeadersEditor";

type PersonaTab = "settings" | "stats" | "code";

export function PersonaDetailPage() {
  const navigate = useNavigate();
  const projectId = useProjectId();
  const { personaId } = useParams<{ personaId: string }>();
  const { data: persona, isLoading, error } = usePersona(personaId ?? null);
  const { data: allPersonas = [] } = usePersonas();
  const lastVisited = useLastVisited("persona");
  const updatePersona = useUpdatePersona();
  const deletePersona = useDeletePersona();
  const generateImage = useGeneratePersonaImage();
  const createPersona = useCreatePersona();

  // Load runs for performance chart
  const { data: runs = [] } = useRunsByPersona(personaId ?? "");
  const [showMenu, setShowMenu] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTab, setActiveTabState] = useState<PersonaTab>(
    () => (localStorage.getItem("personaTab") as PersonaTab) || "settings"
  );
  const setActiveTab = (tab: PersonaTab) => {
    setActiveTabState(tab);
    localStorage.setItem("personaTab", tab);
  };
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [customHeaders, setCustomHeaders] = useState<Array<{ key: string; value: string }>>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [showStyleguideModal, setShowStyleguideModal] = useState(false);

  // Persist last visited persona
  useEffect(() => {
    if (personaId) lastVisited.set(personaId);
  }, [personaId, lastVisited]);

  // Load persona data into form when it changes
  useEffect(() => {
    if (persona) {
      setName(persona.name);
      setDescription(persona.description || "");
      setSystemPrompt(persona.systemPrompt || "");
      setCustomHeaders(
        persona.headers && Object.keys(persona.headers).length > 0
          ? Object.entries(persona.headers).map(([key, value]) => ({ key, value }))
          : []
      );
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
        <button onClick={() => navigate("..", { relative: "path" })} className="btn btn-secondary">
          Back to Personas
        </button>
      </div>
    );
  }

  const handleDelete = async () => {
    setShowMenu(false);
    if (confirm(`Delete persona "${persona.name}"?`)) {
      await deletePersona.mutateAsync(persona.id);
      lastVisited.clear();
      const remaining = allPersonas.filter((p) => p.id !== persona.id);
      if (remaining.length > 0) {
        navigate(`../${remaining[0].id}`, { relative: "path" });
      } else {
        navigate("..", { relative: "path" });
      }
    }
  };

  const handleSave = async () => {
    setSaveError(null);
    if (!name.trim()) {
      setSaveError("Name is required");
      return;
    }

    try {
      const headersWithValues = customHeaders.filter((h) => h.key.trim());
      const headers: Record<string, string> | undefined =
        headersWithValues.length > 0
          ? Object.fromEntries(headersWithValues.map((h) => [h.key.trim(), h.value]))
          : undefined;

      await updatePersona.mutateAsync({
        id: persona.id,
        input: {
          name,
          description: description || undefined,
          systemPrompt: systemPrompt || undefined,
          headers,
        },
      });
      setHasChanges(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  const handleCancel = () => {
    setName(persona.name);
    setDescription(persona.description || "");
    setSystemPrompt(persona.systemPrompt || "");
    setCustomHeaders(
      persona.headers && Object.keys(persona.headers).length > 0
        ? Object.entries(persona.headers).map(([key, value]) => ({ key, value }))
        : []
    );
    setSaveError(null);
    setHasChanges(false);
  };

  const handleGenerateImage = async () => {
    setShowStyleguideModal(false);
    setGenerateError(null);
    try {
      await generateImage.mutateAsync(persona.id);
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "Failed to generate image");
    }
  };

  const imageUrl = persona.imageUrl
    ? projectImageUrl(projectId, persona.imageUrl)
    : null;

  const switcherItems = allPersonas.map((p) => ({
    id: p.id,
    name: p.name || p.id,
  }));

  return (
    <div className="page page-detail persona-detail-page">
      <div className="page-header">
        <div className="page-header-nav">
          <EntitySwitcher
            items={switcherItems}
            activeId={persona.id}
            onSelect={(id) => navigate(`../${id}`, { relative: "path" })}
            onCreate={() => setShowCreateModal(true)}
            entityLabel="persona"
          />
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

      <div className="page-body">
      {saveError && <div className="form-error">{saveError}</div>}

      <div className="persona-detail-tabs">
        <div className="persona-tabs-header">
          <div className="persona-tabs-nav">
            <button
              className={`persona-tab ${activeTab === "settings" ? "active" : ""}`}
              onClick={() => setActiveTab("settings")}
            >
              Settings
            </button>
            <button
              className={`persona-tab ${activeTab === "stats" ? "active" : ""}`}
              onClick={() => setActiveTab("stats")}
            >
              Stats
            </button>
            <button
              className={`persona-tab ${activeTab === "code" ? "active" : ""}`}
              onClick={() => setActiveTab("code")}
            >
              Code
            </button>
          </div>
        </div>

        {activeTab === "settings" && (
          <>
            <div className="persona-detail-content">
              <div className="persona-detail-top">
                <div className="persona-detail-left">
                  <div className="form-group">
                    <label htmlFor="persona-name">Name</label>
                    <input
                      id="persona-name"
                      type="text"
                      value={name}
                      onChange={(e) => handleChange(setName)(e.target.value)}
                      placeholder="Persona name"
                    />
                  </div>

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

                <div className="persona-image-section">
                  <div className="persona-image-preview">
                    {imageUrl ? (
                      <img
                        src={`${imageUrl}?t=${persona.updatedAt}`}
                        alt={`${persona.name} avatar`}
                        className="persona-image"
                      />
                    ) : (
                      <div className="persona-image-placeholder">
                        <span>{persona.name.charAt(0).toUpperCase()}</span>
                      </div>
                    )}
                  </div>
                  <div className="persona-image-actions">
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setShowStyleguideModal(true)}
                      disabled={generateImage.isPending || !persona.systemPrompt}
                      title={!persona.systemPrompt ? "Add a system prompt first" : "Generate portrait with AI"}
                    >
                      {generateImage.isPending ? "Generating..." : imageUrl ? "Regenerate Image" : "Generate Image"}
                    </button>
                    {generateError && <div className="form-error">{generateError}</div>}
                    {generateImage.isPending && (
                      <p className="form-hint">This may take a few seconds...</p>
                    )}
                  </div>
                </div>
              </div>

              <HeadersEditor
                headers={customHeaders}
                onChange={(updated) => {
                  setCustomHeaders(updated);
                  setHasChanges(true);
                }}
                hint="HTTP headers merged with connector headers when making requests. Persona headers take precedence over connector headers."
              />
            </div>
          </>
        )}

        {activeTab === "stats" && (
          <>
            <h3 className="section-label">Trends</h3>
            <PerformanceChart runs={runs} />
            <h3 className="section-label">Recent Runs</h3>
            <RunList personaId={persona.id} />
          </>
        )}

        {activeTab === "code" && (
          <PersonaCodeSnippets persona={persona} />
        )}
      </div>
      </div>

      {showStyleguideModal && (
        <StyleguideModal
          onGenerate={handleGenerateImage}
          onClose={() => setShowStyleguideModal(false)}
          isGenerating={generateImage.isPending}
        />
      )}

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Create Persona</h3>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const input = new FormData(e.currentTarget).get("name") as string;
              if (input?.trim()) {
                const created = await createPersona.mutateAsync({ name: input.trim() });
                setShowCreateModal(false);
                navigate(`../${created.id}`, { relative: "path" });
              }
            }}>
              <div className="form-group">
                <label htmlFor="new-persona-name">Name</label>
                <input id="new-persona-name" name="name" type="text" placeholder="Impatient Customer" autoFocus />
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={createPersona.isPending}>
                  {createPersona.isPending ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
