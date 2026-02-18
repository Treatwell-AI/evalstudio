import { useState, useEffect } from "react";
import { useProviderModels } from "../hooks/useLLMProviders";
import { useProjectConfig, useUpdateProjectConfig } from "../hooks/useProjects";
import type { ProviderType, LLMSettings, LLMModelSettings, ModelGroup } from "../lib/api";

function ModelSelect({
  id,
  value,
  onChange,
  disabled,
  groups,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  groups: ModelGroup[];
  placeholder: string;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    >
      <option value="">
        {disabled ? "Loading models..." : placeholder}
      </option>
      {groups.map((group) => (
        <optgroup key={group.label} label={group.label}>
          {group.models.map((model) => (
            <option key={model} value={model}>{model}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

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

  // Only show model settings after provider has been saved to config
  const hasProvider = !!projectConfig?.llmSettings;

  // Fetch model groups dynamically based on saved provider
  const { data: modelGroups = [], isLoading: loadingModels } = useProviderModels(
    hasProvider ? projectConfig.llmSettings!.provider : undefined
  );

  // Initialize from project config (apiKey is redacted in responses — don't pre-fill)
  useEffect(() => {
    if (projectConfig) {
      if (projectConfig.llmSettings) {
        setProviderType(projectConfig.llmSettings.provider);
      }
      setApiKey("");
      setEvaluationModel(projectConfig.llmSettings?.models?.evaluation || "");
      setPersonaModel(projectConfig.llmSettings?.models?.persona || "");
    }
  }, [projectConfig]);

  const handleSave = async () => {
    setSaveSuccess(false);

    // Build llmSettings — only include apiKey when user entered a new one
    const llmSettings: LLMSettings | null = hasProvider || apiKey
      ? {
          provider: providerType,
          ...(apiKey ? { apiKey } : {}),
          models: buildModelSettings(),
        }
      : null;

    try {
      await updateProjectConfig.mutateAsync({ llmSettings });
      setApiKey("");
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Failed to save LLM settings:", error);
    }
  };

  function buildModelSettings(): LLMModelSettings | undefined {
    const models: LLMModelSettings = {};
    if (evaluationModel) {
      models.evaluation = evaluationModel;
    }
    if (personaModel) {
      models.persona = personaModel;
    }
    return Object.keys(models).length > 0 ? models : undefined;
  }

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
              placeholder={hasProvider ? "Enter new key to change" : "sk-..."}
            />
          </div>
        </div>

        <div className="form-actions">
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={updateProjectConfig.isPending || (!apiKey && !hasProvider)}
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
                <ModelSelect
                  id="evaluation-model"
                  value={evaluationModel}
                  onChange={setEvaluationModel}
                  disabled={loadingModels}
                  groups={modelGroups}
                  placeholder="Provider default"
                />
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
                <ModelSelect
                  id="persona-model"
                  value={personaModel}
                  onChange={setPersonaModel}
                  disabled={loadingModels}
                  groups={modelGroups}
                  placeholder="Same as Evaluation"
                />
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
