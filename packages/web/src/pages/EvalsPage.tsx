import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { EvalList } from "../components/EvalList";
import { EvalForm } from "../components/EvalForm";
import { Project } from "../lib/api";

interface ProjectContext {
  project: Project;
}

export function EvalsPage() {
  const { project } = useOutletContext<ProjectContext>();
  const [showCreateForm, setShowCreateForm] = useState(false);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Evals</h1>
        <button
          className="btn btn-primary"
          onClick={() => setShowCreateForm(true)}
        >
          + New Eval
        </button>
      </div>

      {showCreateForm && (
        <EvalForm
          evalId={null}
          projectId={project.id}
          onClose={() => setShowCreateForm(false)}
        />
      )}

      <EvalList projectId={project.id} />
    </div>
  );
}
