import { Link } from "react-router-dom";
import { useEvals } from "../hooks/useEvals";
import { RunList } from "../components/RunList";
import { ExecutionSummary } from "../components/ExecutionSummary";

export function DashboardPage() {
  const { data: evals, isLoading: loadingEvals } = useEvals();

  return (
    <div className="page">
      <div className="page-header">
        <h1>Dashboard</h1>
      </div>

      <div className="dashboard-grid">
        {!loadingEvals && evals && evals.map((ev) => (
          <div key={ev.id} className="dashboard-eval-summary dashboard-card-wide">
            <Link to={`evals/${ev.id}`} className="dashboard-eval-summary-name">
              {ev.name}
            </Link>
            <ExecutionSummary evalId={ev.id} />
          </div>
        ))}

        <div className="dashboard-card-wide">
          <h3 className="section-label">Recent Runs</h3>
          <RunList mode="project" limit={5} />
        </div>

      </div>
    </div>
  );
}
