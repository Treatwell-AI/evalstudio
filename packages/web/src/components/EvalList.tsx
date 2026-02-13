import { useNavigate } from "react-router-dom";
import { useEvals } from "../hooks/useEvals";
import { useConnectors } from "../hooks/useConnectors";
import { Eval } from "../lib/api";
export function EvalList() {
  const navigate = useNavigate();
  const { data: evals, isLoading, error } = useEvals();
  const { data: connectors } = useConnectors();

  const getConnector = (connectorId: string) => {
    if (!connectors) return null;
    return connectors.find((c) => c.id === connectorId) ?? null;
  };

  const getDisplayName = (evalItem: Eval) => {
    return evalItem.name || evalItem.id;
  };

  if (isLoading) {
    return <div className="loading">Loading evals...</div>;
  }

  if (error) {
    return (
      <div className="error">
        Failed to load evals. Make sure the API server is running.
      </div>
    );
  }

  if (!evals || evals.length === 0) {
    return (
      <div className="empty-state">
        <p>No evals yet. Create an eval to define test configurations for scenarios.</p>
      </div>
    );
  }

  const handleCardClick = (evalId: string) => {
    navigate(`/evals/${evalId}`);
  };

  return (
    <div className="eval-list">
      {evals.map((evalItem) => {
        const connector = getConnector(evalItem.connectorId);
        return (
          <div
            key={evalItem.id}
            className="eval-row eval-row-clickable"
            onClick={() => handleCardClick(evalItem.id)}
          >
            <span className="eval-name">{getDisplayName(evalItem)}</span>
            <span className="eval-meta">
              {connector?.name || "Unknown"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
