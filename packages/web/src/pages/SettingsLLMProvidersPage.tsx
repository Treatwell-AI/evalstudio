import { useState, useEffect } from "react";
import { useProviderModels } from "../hooks/useLLMProviders";
import { useProjectConfig, useUpdateProjectConfig } from "../hooks/useProjects";
import type { ProviderType, ProjectLLMSettings, LLMProviderSettings } from "../lib/api";

export function SettingsLLMProvidersPage() {
  const { data: projectConfig } = useProjectConfig();
  const updateProjectConfig = useUpdateProjectConfig();

  // Provider form state
  const [providerType, setProviderType] = useState<ProviderType>("openai");
  const [apiKey, setApiKey] = useState("");

  // Model selection state
  const [evaluationModel, setEvaluationModel] = useState("");
  const [personaModel, setPersonaModel] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Only show LLM settings after provider has been saved to config
  const hasProvider = !!projectConfig?.llmProvider;

  // Fetch models dynamically based on saved provider
  const { data: models = [], isLoading: loadingModels } = useProviderModels(
    hasProvider ? projectConfig.llmProvider!.provider : undefined
  );

  // Initialize from project config
  useEffect(() => {
    if (projectConfig) {
      if (projectConfig.llmProvider) {
        setProviderType(projectConfig.llmProvider.provider);
        setApiKey(projectConfig.llmProvider.apiKey);
      }
      setEvaluationModel(projectConfig.llmSettings?.evaluation?.model || "");
      setPersonaModel(projectConfig.llmSettings?.persona?.model || "");
    }
  }, [projectConfig]);

  const handleSave = async () => {
    setSaveSuccess(false);

    const llmProvider: LLMProviderSettings | null = apiKey
      ? { provider: providerType, apiKey }
      : null;

    const llmSettings: ProjectLLMSettings = {};
    if (evaluationModel) {
      llmSettings.evaluation = { model: evaluationModel };
    }
    if (personaModel) {
      llmSettings.persona = { model: personaModel };
    }

    try {
      await updateProjectConfig.mutateAsync({
        llmProvider,
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
        <h1>LLM Provider</h1>
      </div>

      <div className="llm-config-section">
        <h2>Provider</h2>
        <p>
          Configure the LLM provider used for evaluation judging and persona generation.
        </p>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="provider-type">Provider</label>
            <select
              id="provider-type"
              value={providerType}
              onChange={(e) => {
                setProviderType(e.target.value as ProviderType);
                setEvaluationModel("");
                setPersonaModel("");
              }}
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="api-key">API Key</label>
            <input
              id="api-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
            />
          </div>
        </div>

        <div className="form-actions">
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={updateProjectConfig.isPending || !apiKey}
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

      {hasProvider && (
        <div className="llm-config-section">
          <h2>Model Configuration</h2>
          <p>
            Select which models to use for evaluation and persona response generation.
          </p>

          <div className="settings-subsection">
            <h3>Evaluation / Judging</h3>
            <p>
              Used to evaluate if conversations meet success/failure criteria.
            </p>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="evaluation-model">Model</label>
                <select
                  id="evaluation-model"
                  value={evaluationModel}
                  onChange={(e) => setEvaluationModel(e.target.value)}
                  disabled={loadingModels}
                >
                  <option value="">
                    {loadingModels ? "Loading models..." : "Provider default"}
                  </option>
                  {models.map((model) => (
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
                <label htmlFor="persona-model">Model</label>
                <select
                  id="persona-model"
                  value={personaModel}
                  onChange={(e) => setPersonaModel(e.target.value)}
                  disabled={loadingModels}
                >
                  <option value="">
                    {loadingModels ? "Loading models..." : "Same as Evaluation"}
                  </option>
                  {models.map((model) => (
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
              onClick={handleSave}
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
