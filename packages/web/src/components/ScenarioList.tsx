import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useScenarios, useDeleteScenario } from "../hooks/useScenarios";
import { Scenario } from "../lib/api";

interface ScenarioListProps {
  selectMode?: boolean;
  onExitSelectMode?: () => void;
}

function exportScenariosAsJsonl(scenarios: Scenario[]) {
  const lines = scenarios.map((s) =>
    JSON.stringify({
      name: s.name,
      instructions: s.instructions ?? null,
      messages: s.messages ?? [],
      successCriteria: s.successCriteria ?? null,
      failureCriteria: s.failureCriteria ?? null,
      failureCriteriaMode: s.failureCriteriaMode ?? null,
    })
  );
  const blob = new Blob([lines.join("\n") + "\n"], {
    type: "application/jsonl",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "scenarios.jsonl";
  a.click();
  URL.revokeObjectURL(url);
}

export function ScenarioList({ selectMode, onExitSelectMode }: ScenarioListProps) {
  const navigate = useNavigate();
  const { data: scenarios, isLoading, error } = useScenarios();
  const deleteScenario = useDeleteScenario();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Clear selection when exiting select mode
  useEffect(() => {
    if (!selectMode) {
      setSelectedIds(new Set());
    }
  }, [selectMode]);

  if (isLoading) {
    return <div className="loading">Loading scenarios...</div>;
  }

  if (error) {
    return (
      <div className="error">
        Failed to load scenarios. Make sure the API server is running.
      </div>
    );
  }

  if (!scenarios || scenarios.length === 0) {
    return (
      <div className="empty-state">
        <p>No scenarios yet. Create a scenario to define test situations for your agent.</p>
      </div>
    );
  }

  const handleRowClick = (scenario: Scenario) => {
    if (selectMode) {
      toggleSelection(scenario.id);
    } else {
      navigate(`/scenarios/${scenario.id}`);
    }
  };

  const handleDelete = async (e: React.MouseEvent, scenario: Scenario) => {
    e.stopPropagation();
    setOpenMenuId(null);
    if (confirm(`Delete scenario "${scenario.name}"?`)) {
      deleteScenario.mutate(scenario.id);
    }
  };

  const handleMenuClick = (e: React.MouseEvent, scenarioId: string) => {
    e.stopPropagation();
    setOpenMenuId(openMenuId === scenarioId ? null : scenarioId);
  };

  const toggleSelection = (scenarioId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(scenarioId)) {
        next.delete(scenarioId);
      } else {
        next.add(scenarioId);
      }
      return next;
    });
  };

  const handleCheckboxChange = (e: React.MouseEvent, scenarioId: string) => {
    e.stopPropagation();
    toggleSelection(scenarioId);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === scenarios.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(scenarios.map((s) => s.id)));
    }
  };

  const handleExport = () => {
    const selected = scenarios.filter((s) => selectedIds.has(s.id));
    exportScenariosAsJsonl(selected);
    onExitSelectMode?.();
  };

  const allSelected = selectedIds.size === scenarios.length;

  return (
    <div className="scenario-list">
      {selectMode && (
        <div className="scenario-list-toolbar">
          <label className="scenario-select-all" onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={allSelected}
              onChange={handleSelectAll}
            />
            <span>{allSelected ? "Deselect all" : "Select all"}</span>
          </label>
          <div className="scenario-toolbar-actions">
            {selectedIds.size > 0 && (
              <span className="scenario-selection-count">
                {selectedIds.size} selected
              </span>
            )}
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => onExitSelectMode?.()}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleExport}
              disabled={selectedIds.size === 0}
            >
              <svg className="btn-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10v4h10v-4" /><path d="M8 12V4" /><path d="M5 7l3-3 3 3" /></svg>
              Export JSONL
            </button>
          </div>
        </div>
      )}
      {scenarios.map((scenario) => (
        <div
          key={scenario.id}
          className={`scenario-row scenario-row-clickable${selectMode && selectedIds.has(scenario.id) ? " scenario-row-selected" : ""}`}
          onClick={() => handleRowClick(scenario)}
        >
          {selectMode && (
            <input
              type="checkbox"
              className="scenario-row-checkbox"
              checked={selectedIds.has(scenario.id)}
              onClick={(e) => handleCheckboxChange(e, scenario.id)}
              onChange={() => {}}
            />
          )}
          <span className="scenario-name">{scenario.name}</span>
          {scenario.instructions && (
            <span className="scenario-description">
              {scenario.instructions.length > 80
                ? scenario.instructions.slice(0, 80) + "..."
                : scenario.instructions}
            </span>
          )}
          {!selectMode && (
            <div className="scenario-menu-container">
              <button
                className="scenario-menu-btn"
                onClick={(e) => handleMenuClick(e, scenario.id)}
                aria-label="Scenario actions"
              >
                ...
              </button>
              {openMenuId === scenario.id && (
                <>
                  <div
                    className="menu-backdrop"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenuId(null);
                    }}
                  />
                  <div className="scenario-menu-dropdown">
                    <button
                      className="scenario-menu-item scenario-menu-item-danger"
                      onClick={(e) => handleDelete(e, scenario)}
                      disabled={deleteScenario.isPending}
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
