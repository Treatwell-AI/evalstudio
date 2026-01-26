import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ProjectList } from "../components/ProjectList";
import { ProjectForm } from "../components/ProjectForm";

export function HomePage() {
  const navigate = useNavigate();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);

  return (
    <div className="app">
      <header className="header">
        <h1>EvalStudio</h1>
      </header>

      <main className="main">
        <div className="section-header">
          <h2>Projects</h2>
          <button
            className="btn btn-primary"
            onClick={() => setShowCreateForm(true)}
          >
            + New Project
          </button>
        </div>

        {(showCreateForm || editingProjectId) && (
          <ProjectForm
            projectId={editingProjectId}
            onClose={() => {
              setShowCreateForm(false);
              setEditingProjectId(null);
            }}
          />
        )}

        <ProjectList
          onEdit={(id) => setEditingProjectId(id)}
          onSelect={(id) => navigate(`/project/${id}`)}
        />
      </main>
    </div>
  );
}
