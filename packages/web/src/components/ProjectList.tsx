import { useProjects, useDeleteProject } from "../hooks/useProjects";
import { Project } from "../lib/api";

interface ProjectListProps {
  onEdit: (id: string) => void;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}

export function ProjectList({ onEdit, selectedId, onSelect }: ProjectListProps) {
  const { data: projects, isLoading, error } = useProjects();
  const deleteProject = useDeleteProject();

  if (isLoading) {
    return <div className="loading">Loading projects...</div>;
  }

  if (error) {
    return (
      <div className="error">
        Failed to load projects. Make sure the API server is running.
      </div>
    );
  }

  if (!projects || projects.length === 0) {
    return (
      <div className="empty-state">
        <p>No projects yet. Create your first project to get started.</p>
      </div>
    );
  }

  const handleDelete = async (project: Project) => {
    if (confirm(`Delete project "${project.name}"?`)) {
      deleteProject.mutate(project.id);
    }
  };

  return (
    <div className="project-list">
      {projects.map((project) => (
        <div
          key={project.id}
          className={`project-card ${selectedId === project.id ? "selected" : ""}`}
          onClick={() => onSelect?.(project.id)}
        >
          <div className="project-info">
            <h3>{project.name}</h3>
            {project.description && <p>{project.description}</p>}
            <span className="project-date">
              Created {new Date(project.createdAt).toLocaleDateString()}
            </span>
          </div>
          <div className="project-actions">
            <button
              className="btn btn-secondary"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(project.id);
              }}
            >
              Edit
            </button>
            <button
              className="btn btn-danger"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(project);
              }}
              disabled={deleteProject.isPending}
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
