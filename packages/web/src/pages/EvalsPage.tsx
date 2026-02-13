import { useState } from "react";
import { EvalList } from "../components/EvalList";
import { EvalForm } from "../components/EvalForm";

export function EvalsPage() {
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
          onClose={() => setShowCreateForm(false)}
        />
      )}

      <EvalList />
    </div>
  );
}
