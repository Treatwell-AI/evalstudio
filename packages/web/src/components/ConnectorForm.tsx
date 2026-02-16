import { useState, useEffect } from "react";
import {
  useConnector,
  useCreateConnector,
  useUpdateConnector,
  useDeleteConnector,
} from "../hooks/useConnectors";
import { ConnectorType, AuthType, LangGraphConnectorConfig } from "../lib/api";

interface ConnectorFormProps {
  connectorId: string | null;
  onClose: () => void;
}

export function ConnectorForm({ connectorId, onClose }: ConnectorFormProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<ConnectorType>("http");
  const [baseUrl, setBaseUrl] = useState("");
  const [authType, setAuthType] = useState<AuthType>("none");
  const [authValue, setAuthValue] = useState("");
  const [assistantId, setAssistantId] = useState("");
  const [configJson, setConfigJson] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: existingConnector } = useConnector(connectorId);
  const createConnector = useCreateConnector();
  const updateConnector = useUpdateConnector();
  const deleteConnector = useDeleteConnector();

  const isEditing = !!connectorId;
  const isPending = createConnector.isPending || updateConnector.isPending || deleteConnector.isPending;

  useEffect(() => {
    if (existingConnector) {
      setName(existingConnector.name);
      setType(existingConnector.type);
      setBaseUrl(existingConnector.baseUrl);
      setAuthType(existingConnector.authType || "none");
      setAuthValue(existingConnector.authValue || "");

      // Extract assistantId from config for langgraph connectors
      if (existingConnector.type === "langgraph" && existingConnector.config) {
        const lgConfig = existingConnector.config as LangGraphConnectorConfig;
        setAssistantId(lgConfig.assistantId || "");
        // Show other config fields without assistantId
        const { assistantId: _, ...otherConfig } = lgConfig;
        if (Object.keys(otherConfig).length > 0) {
          setConfigJson(JSON.stringify(otherConfig, null, 2));
        } else {
          setConfigJson("");
        }
      } else if (existingConnector.config) {
        setConfigJson(JSON.stringify(existingConnector.config, null, 2));
      } else {
        setConfigJson("");
      }
    }
  }, [existingConnector]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    if (!baseUrl.trim()) {
      setError("Base URL is required");
      return;
    }

    // For langgraph, assistantId is required
    if (type === "langgraph" && !assistantId.trim()) {
      setError("Assistant ID is required for LangGraph connectors");
      return;
    }

    // Build config object
    let config: Record<string, unknown> | undefined;

    if (type === "langgraph") {
      // Start with assistantId for langgraph
      config = { assistantId: assistantId.trim() };

      // Merge additional config if provided
      if (configJson.trim()) {
        try {
          const additionalConfig = JSON.parse(configJson);
          config = { ...config, ...additionalConfig };
        } catch {
          setError("Invalid JSON in configuration");
          return;
        }
      }
    } else if (configJson.trim()) {
      // HTTP connector - just use the JSON config
      try {
        config = JSON.parse(configJson);
      } catch {
        setError("Invalid JSON in configuration");
        return;
      }
    }

    try {
      if (isEditing && connectorId) {
        await updateConnector.mutateAsync({
          id: connectorId,
          input: {
            name,
            type,
            baseUrl,
            authType,
            authValue: authType === "none" ? undefined : authValue || undefined,
            config,
          },
        });
      } else {
        await createConnector.mutateAsync({
          name,
          type,
          baseUrl,
          authType: authType === "none" ? undefined : authType,
          authValue: authType === "none" ? undefined : authValue || undefined,
          config,
        });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  const handleDelete = async () => {
    if (!connectorId) return;
    if (confirm(`Delete connector "${name}"?`)) {
      try {
        await deleteConnector.mutateAsync(connectorId);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete connector");
      }
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
        <h3>{isEditing ? "Edit Connector" : "Add Connector"}</h3>

        <form onSubmit={handleSubmit}>
          {error && <div className="form-error">{error}</div>}

          <div className="form-group">
            <label htmlFor="connector-name">Name</label>
            <input
              id="connector-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My LangGraph Agent"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="connector-type">Type</label>
            <select
              id="connector-type"
              value={type}
              onChange={(e) => setType(e.target.value as ConnectorType)}
            >
              <option value="http">HTTP (Generic REST API)</option>
              <option value="langgraph">LangGraph (LangGraph Dev API)</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="connector-base-url">Base URL</label>
            <input
              id="connector-base-url"
              type="url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder={type === "langgraph" ? "http://localhost:8123" : "https://api.example.com"}
            />
            {type === "langgraph" && (
              <span className="form-hint">
                The URL of your LangGraph Dev API server
              </span>
            )}
          </div>

          {type === "langgraph" && (
            <div className="form-group">
              <label htmlFor="connector-assistant-id">Assistant ID *</label>
              <input
                id="connector-assistant-id"
                type="text"
                value={assistantId}
                onChange={(e) => setAssistantId(e.target.value)}
                placeholder="my-assistant"
                required
              />
              <span className="form-hint">
                The assistant ID to use when invoking the LangGraph agent
              </span>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="connector-auth-type">Authentication</label>
            <select
              id="connector-auth-type"
              value={authType}
              onChange={(e) => setAuthType(e.target.value as AuthType)}
            >
              <option value="none">None</option>
              <option value="api-key">API Key</option>
              <option value="bearer">Bearer Token</option>
              <option value="basic">Basic Auth</option>
            </select>
          </div>

          {authType !== "none" && (
            <div className="form-group">
              <label htmlFor="connector-auth-value">
                {authType === "api-key"
                  ? "API Key"
                  : authType === "bearer"
                  ? "Bearer Token"
                  : "Credentials (base64)"}
              </label>
              <input
                id="connector-auth-value"
                type="password"
                value={authValue}
                onChange={(e) => setAuthValue(e.target.value)}
                placeholder={isEditing ? "(unchanged)" : ""}
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="connector-config">
              {type === "langgraph" ? "Additional Configuration (JSON)" : "Configuration (JSON)"}
            </label>
            <textarea
              id="connector-config"
              value={configJson}
              onChange={(e) => setConfigJson(e.target.value)}
              placeholder='{\n  "headers": {},\n  "timeout": 30000\n}'
              rows={4}
            />
            <span className="form-hint">
              {type === "langgraph"
                ? "Optional additional configuration (JSON)"
                : "Optional: headers, timeout, method, path, etc."}
            </span>
          </div>

          <div className="form-actions">
            {isEditing && (
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDelete}
                disabled={isPending}
              >
                Delete
              </button>
            )}
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
