import { useState } from "react";
import { Link } from "react-router-dom";
import { useEvals } from "../hooks/useEvals";
import { useScenarios } from "../hooks/useScenarios";
import { usePersonas } from "../hooks/usePersonas";
import { useRuns } from "../hooks/useRuns";
import { RunList } from "../components/RunList";
import { DashboardPerformanceChart } from "../components/DashboardPerformanceChart";

type ViewMode = "time" | "execution";

export function DashboardPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("time");

  const { data: evals, isLoading: loadingEvals } = useEvals();
  const { data: scenarios, isLoading: loadingScenarios } = useScenarios();
  const { data: personas, isLoading: loadingPersonas } = usePersonas();
  const { data: runs, isLoading: loadingRuns } = useRuns();

  const isLoading = loadingEvals || loadingScenarios || loadingPersonas || loadingRuns;

  const queuedRuns = runs?.filter(r => r.status === "queued").length || 0;
  const passedRuns = runs?.filter(r => r.status === "completed" && r.result?.success).length || 0;
  const failedRuns = runs?.filter(r => r.status === "completed" && r.result && !r.result.success).length || 0;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Dashboard</h1>
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-card">
          <h3>Quick Stats</h3>
          {isLoading ? (
            <p className="text-muted">Loading...</p>
          ) : (
            <div className="stats-grid">
              <Link to="evals" className="stat stat-link">
                <span className="stat-value">{evals?.length || 0}</span>
                <span className="stat-label">Evals</span>
              </Link>
              <Link to="scenarios" className="stat stat-link">
                <span className="stat-value">{scenarios?.length || 0}</span>
                <span className="stat-label">Scenarios</span>
              </Link>
              <Link to="personas" className="stat stat-link">
                <span className="stat-value">{personas?.length || 0}</span>
                <span className="stat-label">Personas</span>
              </Link>
            </div>
          )}
        </div>

        <div className="dashboard-card">
          <h3>Run Stats</h3>
          {isLoading ? (
            <p className="text-muted">Loading...</p>
          ) : (
            <div className="stats-grid">
              <div className="stat">
                <span className="stat-value">{queuedRuns}</span>
                <span className="stat-label">Queued</span>
              </div>
              <div className="stat">
                <span className="stat-value stat-success">{passedRuns}</span>
                <span className="stat-label">Passed</span>
              </div>
              <div className="stat">
                <span className="stat-value stat-failed">{failedRuns}</span>
                <span className="stat-label">Failed</span>
              </div>
            </div>
          )}
        </div>

        <div className="dashboard-card dashboard-card-wide">
          <div className="dashboard-card-header">
            <h3>Performance Overview</h3>
            {!isLoading && runs?.some(r => r.executionId) && (
              <div className="performance-chart-toggle">
                <button
                  className={`performance-chart-toggle-btn ${viewMode === "time" ? "active" : ""}`}
                  onClick={() => setViewMode("time")}
                >
                  By Time
                </button>
                <button
                  className={`performance-chart-toggle-btn ${viewMode === "execution" ? "active" : ""}`}
                  onClick={() => setViewMode("execution")}
                >
                  By Execution
                </button>
              </div>
            )}
          </div>
          {isLoading ? (
            <p className="text-muted">Loading...</p>
          ) : (
            <DashboardPerformanceChart
              runs={runs || []}
              viewMode={viewMode}
            />
          )}
        </div>

        <div className="dashboard-card dashboard-card-wide">
          <h3>Recent Runs</h3>
          <RunList mode="project" limit={5} />
        </div>

      </div>
    </div>
  );
}
