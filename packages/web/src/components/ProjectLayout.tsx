import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { useProjectConfig, useProjectsList } from "../hooks/useProjects";

export function ProjectLayout() {
  const { data: config, isLoading, error } = useProjectConfig();
  const { data: projects } = useProjectsList();

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
      <Sidebar projectName={config.name} projects={projects} />
      <main className="project-content">
        <Outlet />
      </main>
    </div>
  );
}
