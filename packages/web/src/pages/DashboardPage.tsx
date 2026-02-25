import { RunList } from "../components/RunList";
import { RecentEvalCards } from "../components/RecentEvalCards";

export function DashboardPage() {
  return (
    <div className="page">
      <div className="page-header">
        <h1>Dashboard</h1>
      </div>

      <RecentEvalCards />

      <div className="dashboard-grid">
        <div className="dashboard-card-wide">
          <h3 className="section-label">Recent Runs</h3>
          <RunList mode="project" limit={5} />
        </div>
      </div>
    </div>
  );
}
