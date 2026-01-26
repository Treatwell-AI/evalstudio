import { Outlet, useParams } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { useProject } from "../hooks/useProjects";

export function ProjectLayout() {
  const { projectId } = useParams<{ projectId: string }>();
  const { data: project, isLoading, error } = useProject(projectId ?? null);

  if (isLoading) {
    return (
      <div className="project-layout">
        <div className="project-layout-loading">Loading project...</div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="project-layout">
        <div className="project-layout-error">
          <h2>Project not found</h2>
          <p>The project you're looking for doesn't exist or you don't have access to it.</p>
          <a href="/" className="btn btn-primary">
            Back to Projects
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="project-layout">
      <Sidebar projectId={project.id} projectName={project.name} />
      <main className="project-content">
        <Outlet context={{ project }} />
      </main>
    </div>
  );
}
