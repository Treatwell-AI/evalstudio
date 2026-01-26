import { useStatus } from "../hooks/useStatus";

export function StatusBar() {
  const { data: status, isLoading, error } = useStatus();

  if (isLoading) {
    return (
      <div className="floating-status-bar">
        <span className="status-dot status-connecting" />
        <span>Connecting...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="floating-status-bar floating-status-error">
        <span className="status-dot status-offline" />
        <span>API Offline</span>
      </div>
    );
  }

  return (
    <div className="floating-status-bar floating-status-ok">
      <span className="status-dot status-online" />
      <span>v{status?.version}</span>
      <span className="status-separator">·</span>
      <span>Node {status?.node}</span>
    </div>
  );
}
