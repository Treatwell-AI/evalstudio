import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PersonaList } from "../components/PersonaList";
import { useCreatePersona } from "../hooks/usePersonas";

export function PersonasPage() {
  const navigate = useNavigate();
  const createPersona = useCreatePersona();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    try {
      const persona = await createPersona.mutateAsync({
        name: name.trim(),
      });
      setShowCreateModal(false);
      setName("");
      navigate(`/personas/${persona.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  const handleClose = () => {
    setShowCreateModal(false);
    setName("");
    setError(null);
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Personas</h1>
        <button
          className="btn btn-primary"
          onClick={() => setShowCreateModal(true)}
        >
          + New Persona
        </button>
      </div>

      {showCreateModal && (
        <div className="modal-overlay" onClick={handleClose}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Create Persona</h3>
            <form onSubmit={handleCreate}>
              {error && <div className="form-error">{error}</div>}
              <div className="form-group">
                <label htmlFor="persona-name">Name</label>
                <input
                  id="persona-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Impatient Customer"
                  autoFocus
                />
              </div>
              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleClose}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={createPersona.isPending}
                >
                  {createPersona.isPending ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <PersonaList />
    </div>
  );
}
