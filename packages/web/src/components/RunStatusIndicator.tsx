import { Run } from "../lib/api";

interface RunStatusIndicatorProps {
  run: Run;
  messageCount?: number;
}

/**
 * Displays a status indicator for runs that are queued or running.
 * Shows a pulsing dot with status text and optional message count.
 */
export function RunStatusIndicator({ run, messageCount }: RunStatusIndicatorProps) {
  const isRunning = run.status === "queued" || run.status === "running";

  if (!isRunning) return null;

  return (
    <div className="run-status-indicator">
      <span className="status-dot running" />
      <span>
        {run.status === "queued" ? "Queued..." : "Running..."}
        {messageCount !== undefined && messageCount > 0 && ` (${messageCount} messages)`}
      </span>
    </div>
  );
}