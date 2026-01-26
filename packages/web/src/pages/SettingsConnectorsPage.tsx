import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { ConnectorList } from "../components/ConnectorList";
import { ConnectorForm } from "../components/ConnectorForm";
import { Project } from "../lib/api";

interface ProjectContext {
  project: Project;
}

export function SettingsConnectorsPage() {
  const { project } = useOutletContext<ProjectContext>();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingConnectorId, setEditingConnectorId] = useState<string | null>(null);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Connectors</h1>
        <button
          className="btn btn-primary"
          onClick={() => setShowCreateForm(true)}
        >
          + Add Connector
        </button>
      </div>

      {(showCreateForm || editingConnectorId) && (
        <ConnectorForm
          connectorId={editingConnectorId}
          projectId={project.id}
          onClose={() => {
            setShowCreateForm(false);
            setEditingConnectorId(null);
          }}
        />
      )}

      <ConnectorList
        projectId={project.id}
        onEdit={(id) => setEditingConnectorId(id)}
      />
    </div>
  );
}
