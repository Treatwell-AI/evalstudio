import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { EntityRedirect } from "../components/EntityRedirect";
import { EvalForm } from "../components/EvalForm";
import { useEvals } from "../hooks/useEvals";

export function EvalsPage() {
  const navigate = useNavigate();
  const { data: evals, isLoading } = useEvals();
  const [showCreateForm, setShowCreateForm] = useState(false);

  return (
    <>
      <EntityRedirect
        entityType="eval"
        items={evals}
        isLoading={isLoading}
        fallback={
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
            <div className="empty-state">
              <p>No evals yet. Create an eval to define test configurations for scenarios.</p>
            </div>
            {showCreateForm && (
              <EvalForm
                evalId={null}
                onClose={(createdId) => {
                  setShowCreateForm(false);
                  if (createdId) navigate(createdId);
                }}
              />
            )}
          </div>
        }
      />
    </>
  );
}
