import { useState } from "react";
import { useConnectors, useTestConnector } from "../hooks/useConnectors";
import { Connector, ConnectorTestResult } from "../lib/api";

interface ConnectorListProps {
  onEdit: (id: string) => void;
}

function maskValue(value: string): string {
  if (value.length <= 8) {
    return "****";
  }
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function getTypeLabel(type: string): string {
  switch (type) {
    case "http":
      return "HTTP";
    case "langgraph":
      return "LangGraph";
    default:
      return type;
  }
}

export function ConnectorList({ onEdit }: ConnectorListProps) {
  const { data: connectors, isLoading, error } = useConnectors();
  const testConnector = useTestConnector();
  const [testResults, setTestResults] = useState<Record<string, ConnectorTestResult | "testing">>({});

  if (isLoading) {
    return <div className="loading">Loading connectors...</div>;
  }

  if (error) {
    return (
      <div className="error">
        Failed to load connectors. Make sure the API server is running.
      </div>
    );
  }

  if (!connectors || connectors.length === 0) {
    return (
      <div className="empty-state">
        <p>No connectors configured. Add a connector to bridge EvalStudio to your API endpoints.</p>
      </div>
    );
  }

  const handleTest = async (connector: Connector) => {
    setTestResults((prev) => ({ ...prev, [connector.id]: "testing" }));
    try {
      const result = await testConnector.mutateAsync(connector.id);
      setTestResults((prev) => ({ ...prev, [connector.id]: result }));
    } catch (err) {
      setTestResults((prev) => ({
        ...prev,
        [connector.id]: {
          success: false,
          latencyMs: 0,
          error: err instanceof Error ? err.message : "Test failed",
        },
      }));
    }
  };

  return (
    <div className="connector-list">
      {connectors.map((connector) => (
        <div key={connector.id} className="connector-card">
          <div className="connector-card-inner">
            <div className="connector-info">
              <h4>{connector.name} <span className="connector-type">{getTypeLabel(connector.type)}</span></h4>
              <div className="connector-details">
                <span className="connector-url">
                  URL: {connector.baseUrl}
                </span>
                {connector.authType && connector.authType !== "none" && (
                  <span className="connector-auth">
                    Auth: {connector.authType}
                    {connector.authValue && ` (${maskValue(connector.authValue)})`}
                  </span>
                )}
                {connector.config && Object.keys(connector.config).length > 0 && (
                  <span className="connector-config">
                    Config: {JSON.stringify(connector.config)}
                  </span>
                )}
              </div>
            </div>
            <div className="connector-actions">
              <button
                className="btn btn-primary btn-sm"
                onClick={() => handleTest(connector)}
                disabled={testResults[connector.id] === "testing"}
              >
                {testResults[connector.id] === "testing" ? "Testing..." : "Test"}
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => onEdit(connector.id)}
              >
                Edit
              </button>
            </div>
          </div>
          {testResults[connector.id] && testResults[connector.id] !== "testing" && (
            <div
              className={`connector-test-result ${
                (testResults[connector.id] as ConnectorTestResult).success
                  ? "test-success"
                  : "test-error"
              }`}
            >
              <span className="test-status">
                {(testResults[connector.id] as ConnectorTestResult).success
                  ? "Connected successfully"
                  : "Connection failed"}
              </span>
              <span className="test-latency">
                {(testResults[connector.id] as ConnectorTestResult).latencyMs}ms
              </span>
              {(testResults[connector.id] as ConnectorTestResult).response && (
                <span className="test-response">
                  Response: {(testResults[connector.id] as ConnectorTestResult).response}
                </span>
              )}
              {(testResults[connector.id] as ConnectorTestResult).error && (
                <span className="test-error-msg">
                  Error: {(testResults[connector.id] as ConnectorTestResult).error}
                </span>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
