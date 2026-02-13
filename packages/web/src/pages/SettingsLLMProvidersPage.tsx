import { useState, useEffect } from "react";
import { LLMProviderList } from "../components/LLMProviderList";
import { LLMProviderForm } from "../components/LLMProviderForm";
import { useLLMProviders, useProviderModels } from "../hooks/useLLMProviders";
import { useProjectConfig, useUpdateProjectConfig } from "../hooks/useProjects";
import { ProjectLLMSettings } from "../lib/api";

export function SettingsLLMProvidersPage() {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingProviderId, setEditingProviderId] = useState<string | null>(null);

  const { data: providers = [] } = useLLMProviders();
  const { data: projectConfig } = useProjectConfig();
  const updateProjectConfig = useUpdateProjectConfig();

  // LLM defaults form state
  const [evaluationProviderId, setEvaluationProviderId] = useState("");
  const [evaluationModel, setEvaluationModel] = useState("");
  const [personaProviderId, setPersonaProviderId] = useState("");
  const [personaModel, setPersonaModel] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Fetch models dynamically based on selected providers
  const { data: evaluationModels = [], isLoading: loadingEvalModels } = useProviderModels(
    evaluationProviderId || undefined
  );
  const { data: personaModels = [], isLoading: loadingPersonaModels } = useProviderModels(
    personaProviderId || undefined
  );

  // Initialize from project config settings
  useEffect(() => {
    if (projectConfig?.llmSettings) {
      setEvaluationProviderId(projectConfig.llmSettings.evaluation?.providerId || "");
      setEvaluationModel(projectConfig.llmSettings.evaluation?.model || "");
      setPersonaProviderId(projectConfig.llmSettings.persona?.providerId || "");
      setPersonaModel(projectConfig.llmSettings.persona?.model || "");
    }
  }, [projectConfig]);

  const handleSaveDefaults = async () => {
    setSaveSuccess(false);

    const llmSettings: ProjectLLMSettings = {};

    if (evaluationProviderId) {
      llmSettings.evaluation = {
        providerId: evaluationProviderId,
        model: evaluationModel || undefined,
      };
    }

    if (personaProviderId) {
      llmSettings.persona = {
        providerId: personaProviderId,
        model: personaModel || undefined,
      };
    }

    try {
      await updateProjectConfig.mutateAsync({
        llmSettings: Object.keys(llmSettings).length > 0 ? llmSettings : null,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Failed to save LLM settings:", error);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>LLM Providers</h1>
        <button
          className="btn btn-primary"
          onClick={() => setShowCreateForm(true)}
        >
          + Add Provider
        </button>
      </div>

      {(showCreateForm || editingProviderId) && (
        <LLMProviderForm
          providerId={editingProviderId}
          onClose={() => {
            setShowCreateForm(false);
            setEditingProviderId(null);
          }}
        />
      )}

      <LLMProviderList
        onEdit={(id) => setEditingProviderId(id)}
      />

      {providers.length > 0 && (
        <div className="llm-config-section">
          <h2>Configuration</h2>
          <p>
            Select which providers and models to use for evaluation and persona response generation.
          </p>

          <div className="settings-subsection">
            <h3>Evaluation / Judging</h3>
            <p>
              Used to evaluate if conversations meet success/failure criteria.
            </p>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="evaluation-provider">Provider</label>
                <select
                  id="evaluation-provider"
                  value={evaluationProviderId}
                  onChange={(e) => {
                    setEvaluationProviderId(e.target.value);
                    setEvaluationModel("");
                  }}
                >
                  <option value="">-- Select Provider --</option>
                  {providers.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name} ({provider.provider})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="evaluation-model">Model</label>
                <select
                  id="evaluation-model"
                  value={evaluationModel}
                  onChange={(e) => setEvaluationModel(e.target.value)}
                  disabled={!evaluationProviderId || loadingEvalModels}
                >
                  <option value="">
                    {loadingEvalModels ? "Loading models..." : "Provider default"}
                  </option>
                  {evaluationModels.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="settings-subsection">
            <h3>Persona Response Generation</h3>
            <p>
              Used to generate simulated user responses during multi-turn conversations.
            </p>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="persona-provider">Provider</label>
                <select
                  id="persona-provider"
                  value={personaProviderId}
                  onChange={(e) => {
                    setPersonaProviderId(e.target.value);
                    setPersonaModel("");
                  }}
                >
                  <option value="">Same as Evaluation</option>
                  {providers.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name} ({provider.provider})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="persona-model">Model</label>
                <select
                  id="persona-model"
                  value={personaModel}
                  onChange={(e) => setPersonaModel(e.target.value)}
                  disabled={!personaProviderId || loadingPersonaModels}
                >
                  <option value="">
                    {loadingPersonaModels
                      ? "Loading models..."
                      : personaProviderId
                        ? "Provider default"
                        : "Same as Evaluation"}
                  </option>
                  {personaModels.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="form-actions">
            <button
              className="btn btn-primary"
              onClick={handleSaveDefaults}
              disabled={updateProjectConfig.isPending}
            >
              {updateProjectConfig.isPending ? "Saving..." : "Save"}
            </button>
            {saveSuccess && <span className="save-success">Settings saved!</span>}
            {updateProjectConfig.isError && (
              <span className="save-error">
                Error: {(updateProjectConfig.error as Error)?.message}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
