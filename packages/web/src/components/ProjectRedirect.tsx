import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

/**
 * Redirects the root URL to the first project's dashboard.
 * Shows a loading state while fetching the project list.
 */
export function ProjectRedirect() {
  const { data: projects, isLoading, error } = useQuery({
    queryKey: ["projects"],
    queryFn: api.projects.list,
  });

  if (isLoading) {
    return (
      <div className="project-layout">
        <div className="project-layout-loading">Loading...</div>
      </div>
    );
  }

  if (error || !projects || projects.length === 0) {
    return (
      <div className="project-layout">
        <div className="project-layout-error">
          <h2>No projects found</h2>
          <p>Initialize a workspace with <code>evalstudio init</code> to get started.</p>
        </div>
      </div>
    );
  }

  return <Navigate to={`/projects/${projects[0].id}`} replace />;
}
