import { useState, useEffect } from "react";
import {
  useProject,
  useCreateProject,
  useUpdateProject,
} from "../hooks/useProjects";

interface ProjectFormProps {
  projectId: string | null;
  onClose: () => void;
}

export function ProjectForm({ projectId, onClose }: ProjectFormProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: project } = useProject(projectId);
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();

  const isEditing = !!projectId;
  const isPending = createProject.isPending || updateProject.isPending;

  useEffect(() => {
    if (project) {
      setName(project.name);
      setDescription(project.description || "");
    }
  }, [project]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    try {
      if (isEditing && projectId) {
        await updateProject.mutateAsync({
          id: projectId,
          input: { name, description: description || undefined },
        });
      } else {
        await createProject.mutateAsync({
          name,
          description: description || undefined,
        });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{isEditing ? "Edit Project" : "Create Project"}</h3>

        <form onSubmit={handleSubmit}>
          {error && <div className="form-error">{error}</div>}

          <div className="form-group">
            <label htmlFor="name">Name</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-project"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Description (optional)</label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A brief description of the project"
              rows={3}
            />
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isPending}
            >
              {isPending ? "Saving..." : isEditing ? "Save" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
