import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePersonas, useDeletePersona } from "../hooks/usePersonas";
import { Persona } from "../lib/api";

interface PersonaListProps {
  projectId: string;
}

export function PersonaList({ projectId }: PersonaListProps) {
  const navigate = useNavigate();
  const { data: personas, isLoading, error } = usePersonas(projectId);
  const deletePersona = useDeletePersona();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  if (isLoading) {
    return <div className="loading">Loading personas...</div>;
  }

  if (error) {
    return (
      <div className="error">
        Failed to load personas. Make sure the API server is running.
      </div>
    );
  }

  if (!personas || personas.length === 0) {
    return (
      <div className="empty-state">
        <p>No personas yet. Create a persona to simulate different user interactions.</p>
      </div>
    );
  }

  const handleRowClick = (persona: Persona) => {
    navigate(`/project/${projectId}/personas/${persona.id}`);
  };

  const handleDelete = async (e: React.MouseEvent, persona: Persona) => {
    e.stopPropagation();
    setOpenMenuId(null);
    if (confirm(`Delete persona "${persona.name}"?`)) {
      deletePersona.mutate(persona.id);
    }
  };

  const handleMenuClick = (e: React.MouseEvent, personaId: string) => {
    e.stopPropagation();
    setOpenMenuId(openMenuId === personaId ? null : personaId);
  };

  return (
    <div className="persona-list">
      {personas.map((persona) => (
        <div
          key={persona.id}
          className="persona-row persona-row-clickable"
          onClick={() => handleRowClick(persona)}
        >
          <span className="persona-name">{persona.name}</span>
          {persona.description && (
            <span className="persona-description">{persona.description}</span>
          )}
          <div className="persona-menu-container">
            <button
              className="persona-menu-btn"
              onClick={(e) => handleMenuClick(e, persona.id)}
              aria-label="Persona actions"
            >
              ...
            </button>
            {openMenuId === persona.id && (
              <>
                <div
                  className="menu-backdrop"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenMenuId(null);
                  }}
                />
                <div className="persona-menu-dropdown">
                  <button
                    className="persona-menu-item persona-menu-item-danger"
                    onClick={(e) => handleDelete(e, persona)}
                    disabled={deletePersona.isPending}
                  >
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
