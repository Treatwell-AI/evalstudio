import { useState, useEffect } from "react";
import {
  useLLMProvider,
  useCreateLLMProvider,
  useUpdateLLMProvider,
} from "../hooks/useLLMProviders";
import { ProviderType } from "../lib/api";

interface LLMProviderFormProps {
  providerId: string | null;
  projectId: string;
  onClose: () => void;
}

export function LLMProviderForm({ providerId, projectId, onClose }: LLMProviderFormProps) {
  const [name, setName] = useState("");
  const [provider, setProvider] = useState<ProviderType>("openai");
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: existingProvider } = useLLMProvider(providerId);
  const createProvider = useCreateLLMProvider();
  const updateProvider = useUpdateLLMProvider();

  const isEditing = !!providerId;
  const isPending = createProvider.isPending || updateProvider.isPending;

  useEffect(() => {
    if (existingProvider) {
      setName(existingProvider.name);
      setProvider(existingProvider.provider);
      setApiKey(existingProvider.apiKey);
    }
  }, [existingProvider]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    if (!apiKey.trim()) {
      setError("API key is required");
      return;
    }

    try {
      if (isEditing && providerId) {
        await updateProvider.mutateAsync({
          id: providerId,
          input: {
            name,
            provider,
            apiKey,
          },
        });
      } else {
        await createProvider.mutateAsync({
          projectId,
          name,
          provider,
          apiKey,
        });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
        <h3>{isEditing ? "Edit LLM Provider" : "Add LLM Provider"}</h3>

        <form onSubmit={handleSubmit}>
          {error && <div className="form-error">{error}</div>}

          <div className="form-group">
            <label htmlFor="provider-name">Name</label>
            <input
              id="provider-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Production OpenAI"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="provider-type">Provider</label>
            <select
              id="provider-type"
              value={provider}
              onChange={(e) => setProvider(e.target.value as ProviderType)}
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="provider-api-key">API Key</label>
            <input
              id="provider-api-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={isEditing ? "(unchanged)" : "sk-..."}
            />
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isPending}
            >
              {isPending ? "Saving..." : isEditing ? "Save" : "Add"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
