import { useState } from "react";
import { useLLMProviders, useDeleteLLMProvider } from "../hooks/useLLMProviders";
import { LLMProvider } from "../lib/api";

interface LLMProviderListProps {
  projectId: string;
  onEdit: (id: string) => void;
}

function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 8) {
    return "****";
  }
  return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
}

export function LLMProviderList({ projectId, onEdit }: LLMProviderListProps) {
  const { data: providers, isLoading, error } = useLLMProviders(projectId);
  const deleteProvider = useDeleteLLMProvider();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  if (isLoading) {
    return <div className="loading">Loading LLM providers...</div>;
  }

  if (error) {
    return (
      <div className="error">
        Failed to load LLM providers. Make sure the API server is running.
      </div>
    );
  }

  if (!providers || providers.length === 0) {
    return (
      <div className="empty-state">
        <p>No LLM providers configured. Add a provider to use LLM-as-judge evaluations and persona simulations.</p>
      </div>
    );
  }

  const handleEdit = (e: React.MouseEvent, provider: LLMProvider) => {
    e.stopPropagation();
    setOpenMenuId(null);
    onEdit(provider.id);
  };

  const handleDelete = async (e: React.MouseEvent, provider: LLMProvider) => {
    e.stopPropagation();
    setOpenMenuId(null);
    if (confirm(`Delete LLM provider "${provider.name}"?`)) {
      deleteProvider.mutate(provider.id);
    }
  };

  const handleMenuClick = (e: React.MouseEvent, providerId: string) => {
    e.stopPropagation();
    setOpenMenuId(openMenuId === providerId ? null : providerId);
  };

  return (
    <div className="llm-provider-list">
      {providers.map((provider) => (
        <div key={provider.id} className="llm-provider-row">
          <span className="llm-provider-name">{provider.name}</span>
          <span className="llm-provider-type">{provider.provider}</span>
          <span className="llm-provider-key">{maskApiKey(provider.apiKey)}</span>
          <div className="llm-provider-menu-container">
            <button
              className="llm-provider-menu-btn"
              onClick={(e) => handleMenuClick(e, provider.id)}
              aria-label="Provider actions"
            >
              ⋮
            </button>
            {openMenuId === provider.id && (
              <>
                <div
                  className="menu-backdrop"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenMenuId(null);
                  }}
                />
                <div className="llm-provider-menu-dropdown">
                  <button
                    className="llm-provider-menu-item"
                    onClick={(e) => handleEdit(e, provider)}
                  >
                    Edit
                  </button>
                  <button
                    className="llm-provider-menu-item llm-provider-menu-item-danger"
                    onClick={(e) => handleDelete(e, provider)}
                    disabled={deleteProvider.isPending}
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
