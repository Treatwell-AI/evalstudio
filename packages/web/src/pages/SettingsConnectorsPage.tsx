import { useState } from "react";
import { ConnectorList } from "../components/ConnectorList";
import { ConnectorForm } from "../components/ConnectorForm";

export function SettingsConnectorsPage() {
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
          onClose={() => {
            setShowCreateForm(false);
            setEditingConnectorId(null);
          }}
        />
      )}

      <ConnectorList
        onEdit={(id) => setEditingConnectorId(id)}
      />
    </div>
  );
}
