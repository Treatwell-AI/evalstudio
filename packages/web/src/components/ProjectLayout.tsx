import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { useProjectConfig } from "../hooks/useProjects";

export function ProjectLayout() {
  const { data: config, isLoading, error } = useProjectConfig();

  if (isLoading) {
    return (
      <div className="project-layout">
        <div className="project-layout-loading">Loading project...</div>
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="project-layout">
        <div className="project-layout-error">
          <h2>Project not found</h2>
          <pre>{error?.message || "Unable to load project configuration."}</pre>
        </div>
      </div>
    );
  }

  return (
    <div className="project-layout">
      <Sidebar projectName={config.name} />
      <main className="project-content">
        <Outlet />
      </main>
    </div>
  );
}
