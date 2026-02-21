import { useState, useEffect } from "react";
import {
  useConnector,
  useCreateConnector,
  useUpdateConnector,
  useDeleteConnector,
} from "../hooks/useConnectors";
import { ConnectorType, HttpConnectorConfig, LangGraphConnectorConfig } from "../lib/api";
import { HeadersEditor } from "./HeadersEditor";

interface ConnectorFormProps {
  connectorId: string | null;
  onClose: () => void;
}

export function ConnectorForm({ connectorId, onClose }: ConnectorFormProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<ConnectorType>("http");
  const [baseUrl, setBaseUrl] = useState("");
  const [customHeaders, setCustomHeaders] = useState<Array<{ key: string; value: string }>>([]);
  const [assistantId, setAssistantId] = useState("");
  const [configurableJson, setConfigurableJson] = useState("");
  const [httpMethod, setHttpMethod] = useState<"GET" | "POST" | "PUT" | "PATCH">("POST");
  const [httpPath, setHttpPath] = useState("");
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

      // Load custom headers
      if (existingConnector.headers && Object.keys(existingConnector.headers).length > 0) {
        setCustomHeaders(
          Object.entries(existingConnector.headers).map(([key, value]) => ({ key, value }))
        );
      } else {
        setCustomHeaders([]);
      }

      // Extract assistantId and configurable from config for langgraph connectors
      if (existingConnector.type === "langgraph" && existingConnector.config) {
        const lgConfig = existingConnector.config as LangGraphConnectorConfig;
        setAssistantId(lgConfig.assistantId || "");
        if (lgConfig.configurable && Object.keys(lgConfig.configurable).length > 0) {
          setConfigurableJson(JSON.stringify(lgConfig.configurable, null, 2));
        } else {
          setConfigurableJson("");
        }
      } else if (existingConnector.type === "http" && existingConnector.config) {
        const httpConfig = existingConnector.config as HttpConnectorConfig;
        setHttpMethod(httpConfig.method || "POST");
        setHttpPath(httpConfig.path || "");
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

    // Build custom headers object
    const headersWithValues = customHeaders.filter((h) => h.key.trim());
    const headers: Record<string, string> | undefined =
      headersWithValues.length > 0
        ? Object.fromEntries(headersWithValues.map((h) => [h.key.trim(), h.value]))
        : undefined;

    // Build config object
    let config: Record<string, unknown> | undefined;

    if (type === "langgraph") {
      config = { assistantId: assistantId.trim() };

      if (configurableJson.trim()) {
        try {
          const configurable = JSON.parse(configurableJson);
          config = { ...config, configurable };
        } catch {
          setError("Invalid JSON in configurable");
          return;
        }
      }
    } else if (type === "http") {
      const hasMethod = httpMethod !== "POST";
      const hasPath = httpPath.trim() !== "";
      if (hasMethod || hasPath) {
        config = {
          ...(hasMethod && { method: httpMethod }),
          ...(hasPath && { path: httpPath.trim() }),
        };
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
            headers,
            config,
          },
        });
      } else {
        await createConnector.mutateAsync({
          name,
          type,
          baseUrl,
          headers,
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
            <>
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
              <div className="form-group">
                <label htmlFor="connector-configurable">Configurable (JSON)</label>
                <textarea
                  id="connector-configurable"
                  value={configurableJson}
                  onChange={(e) => setConfigurableJson(e.target.value)}
                  placeholder={`{\n  "key": "value"\n}`}
                  rows={3}
                />
                <span className="form-hint">
                  Optional values sent as config.configurable in invoke requests
                </span>
              </div>
            </>
          )}

          {type === "http" && (
            <>
              <div className="form-group">
                <label htmlFor="connector-method">Method</label>
                <select
                  id="connector-method"
                  value={httpMethod}
                  onChange={(e) => setHttpMethod(e.target.value as "GET" | "POST" | "PUT" | "PATCH")}
                >
                  <option value="POST">POST</option>
                  <option value="GET">GET</option>
                  <option value="PUT">PUT</option>
                  <option value="PATCH">PATCH</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="connector-path">Path</label>
                <input
                  id="connector-path"
                  type="text"
                  value={httpPath}
                  onChange={(e) => setHttpPath(e.target.value)}
                  placeholder="/v1/chat"
                />
                <span className="form-hint">
                  Optional path appended to the base URL
                </span>
              </div>
            </>
          )}

          <HeadersEditor
            headers={customHeaders}
            onChange={setCustomHeaders}
            hint="Custom headers sent with every request (e.g. Authorization, API keys)"
          />

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
