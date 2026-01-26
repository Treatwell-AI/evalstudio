import { useState, useMemo } from "react";
import { Message, ToolCall, getMessageContent } from "../lib/api";

/** Map of tool_call_id to tool result message */
type ToolResultsMap = Map<string, Message>;

/** Build a map of tool_call_id -> tool result message for quick lookup */
function buildToolResultsMap(messages: Message[]): ToolResultsMap {
  const map = new Map<string, Message>();
  for (const msg of messages) {
    if (msg.role === "tool" && msg.tool_call_id) {
      map.set(msg.tool_call_id, msg);
    }
  }
  return map;
}

/** Check if a tool message's result is shown inline with a tool call */
function isToolResultShownInline(message: Message, toolResultsMap: ToolResultsMap): boolean {
  if (message.role !== "tool" || !message.tool_call_id) return false;
  return toolResultsMap.has(message.tool_call_id);
}

/** Format tool result content (try JSON pretty print) */
function formatToolResult(message: Message): string {
  const content = getMessageContent(message);
  try {
    const parsed = JSON.parse(content);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return content;
  }
}

/** Format a value for display (handles objects, arrays, primitives) */
function formatArgValue(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** Check if an assistant message has only tool calls (no text content) */
function isToolCallOnlyMessage(message: Message): boolean {
  if (message.role !== "assistant") return false;
  const content = getMessageContent(message);
  const hasToolCalls = message.tool_calls && message.tool_calls.length > 0;
  return (!content || content.trim() === "") && !!hasToolCalls;
}

function ToolCallWithResult({ call, result }: { call: ToolCall; result?: Message }) {
  const [expanded, setExpanded] = useState(false);
  const argEntries = Object.entries(call.args || {});

  return (
    <div className={`run-preview-tool-call ${expanded ? "expanded" : "collapsed"}`}>
      <div
        className="run-preview-tool-call-header"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="run-preview-tool-call-title">
          <span className="run-preview-role">tool - <span className="run-preview-tool-name">{call.name}</span></span>
        </div>
        <button className="run-preview-expand-btn">
          {expanded ? "Collapse" : "Expand"}
        </button>
      </div>
      {expanded && (
        <div className="run-preview-tool-call-body">
          {argEntries.length > 0 && (
            <div className="run-preview-tool-section">
              <span className="run-preview-tool-section-label">Input</span>
              <div className="run-preview-tool-args-list">
                {argEntries.map(([key, value]) => (
                  <div key={key} className="run-preview-tool-arg">
                    <span className="run-preview-tool-arg-key">{key}</span>
                    <span className="run-preview-tool-arg-value">{formatArgValue(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {result && (
            <div className="run-preview-tool-section run-preview-tool-section-result">
              <span className="run-preview-tool-section-label">Output</span>
              <pre className="run-preview-tool-result-content">
                {formatToolResult(result)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ToolCallsDisplay({ toolCalls, toolResults }: { toolCalls: ToolCall[]; toolResults: ToolResultsMap }) {
  return (
    <div className="run-preview-tool-calls">
      {toolCalls.map((call, index) => (
        <ToolCallWithResult
          key={call.id || index}
          call={call}
          result={call.id ? toolResults.get(call.id) : undefined}
        />
      ))}
    </div>
  );
}

interface MessagesDisplayProps {
  messages: Message[];
  /** Additional messages to show after the main messages (e.g., simulated responses) */
  additionalContent?: React.ReactNode;
  /** Result panel content */
  result?: {
    success: boolean;
    score?: number;
    reason?: string;
  } | null;
  /** Evaluation details from the run output */
  evaluationDetails?: {
    successMet?: boolean;
    failureMet?: boolean;
    confidence?: number;
    reasoning?: string;
    messageCount?: number;
    avgLatencyMs?: number;
    maxMessagesReached?: boolean;
  } | null;
  /** Error message to display */
  error?: string | null;
  /** Empty state message */
  emptyMessage?: string;
}

export function MessagesDisplay({
  messages,
  additionalContent,
  result,
  evaluationDetails,
  error,
  emptyMessage = "No messages.",
}: MessagesDisplayProps) {
  const [systemExpanded, setSystemExpanded] = useState(false);

  // Build tool results map for inline display
  const toolResultsMap = useMemo(() => buildToolResultsMap(messages), [messages]);

  // Separate system messages from conversation messages
  // Also filter out tool messages that are shown inline with their tool calls
  const systemMessages = messages.filter((m) => m.role === "system");
  const conversationMessages = messages.filter(
    (m) => m.role !== "system" && !isToolResultShownInline(m, toolResultsMap)
  );

  const hasContent = systemMessages.length > 0 || conversationMessages.length > 0 || additionalContent;

  return (
    <div className="run-preview-content">
      {systemMessages.length > 0 && (
        <div className="run-preview-system-section">
          <div
            className="run-preview-system-header"
            onClick={() => setSystemExpanded(!systemExpanded)}
          >
            <span className="run-preview-role">system</span>
            <button className="run-preview-expand-btn">
              {systemExpanded ? "Collapse" : "Expand"}
            </button>
          </div>
          <div
            className={`run-preview-system-content ${systemExpanded ? "expanded" : ""}`}
          >
            {systemMessages.map((message, index) => (
              <div key={index} className="run-preview-content-text">
                {getMessageContent(message)}
              </div>
            ))}
          </div>
        </div>
      )}

      {conversationMessages.length > 0 || additionalContent ? (
        <div className="run-preview-messages">
          {conversationMessages.map((message, index) =>
            isToolCallOnlyMessage(message) ? (
              // Tool-call-only messages: render tool calls directly without assistant wrapper
              <ToolCallsDisplay
                key={index}
                toolCalls={message.tool_calls!}
                toolResults={toolResultsMap}
              />
            ) : (
              <div
                key={index}
                className={`run-preview-message run-preview-message-${message.role}`}
              >
                <span className="run-preview-role">{message.role}</span>
                <div className="run-preview-content-text">{getMessageContent(message)}</div>
                {message.tool_calls && message.tool_calls.length > 0 && (
                  <ToolCallsDisplay toolCalls={message.tool_calls} toolResults={toolResultsMap} />
                )}
              </div>
            )
          )}
          {additionalContent}
        </div>
      ) : (
        !hasContent && (
          <div className="run-preview-empty">
            {emptyMessage}
          </div>
        )
      )}

      {result && (
        <div className={`run-result-panel ${result.success ? "success" : "failed"}`}>
          <div className="run-result-header">
            <strong>{result.success ? "Passed" : "Failed"}</strong>
            {result.score !== undefined && (
              <span className="run-result-score">
                Confidence: {Math.round(result.score * 100)}%
              </span>
            )}
          </div>
          {result.reason && <p>{result.reason}</p>}
        </div>
      )}

      {evaluationDetails && (
        <div className="run-evaluation-details">
          <div className="run-evaluation-header">Evaluation Details</div>
          <div className="run-evaluation-grid">
            {evaluationDetails.messageCount !== undefined && (
              <div className="run-evaluation-item">
                <span className="run-evaluation-label">Messages</span>
                <span className="run-evaluation-value">{evaluationDetails.messageCount}</span>
              </div>
            )}
            {evaluationDetails.avgLatencyMs !== undefined && (
              <div className="run-evaluation-item">
                <span className="run-evaluation-label">Avg Latency</span>
                <span className="run-evaluation-value">
                  {evaluationDetails.avgLatencyMs >= 1000
                    ? `${(evaluationDetails.avgLatencyMs / 1000).toFixed(1)}s`
                    : `${evaluationDetails.avgLatencyMs}ms`}
                </span>
              </div>
            )}
            {evaluationDetails.successMet !== undefined && (
              <div className="run-evaluation-item">
                <span className="run-evaluation-label">Success Criteria</span>
                <span className={`run-evaluation-value ${evaluationDetails.successMet ? "met" : "not-met"}`}>
                  {evaluationDetails.successMet ? "Met" : "Not Met"}
                </span>
              </div>
            )}
            {evaluationDetails.failureMet !== undefined && (
              <div className="run-evaluation-item">
                <span className="run-evaluation-label">Failure Criteria</span>
                <span className={`run-evaluation-value ${evaluationDetails.failureMet ? "triggered" : "not-triggered"}`}>
                  {evaluationDetails.failureMet ? "Triggered" : "Not Triggered"}
                </span>
              </div>
            )}
            {evaluationDetails.maxMessagesReached && (
              <div className="run-evaluation-item full-width">
                <span className="run-evaluation-warning">Max messages limit reached</span>
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="run-error-panel">
          <strong>Error:</strong> {error}
        </div>
      )}
    </div>
  );
}

/** Helper component for displaying simulated/loading responses */
export function SimulatedMessage({
  messages,
  latencyMs,
  isLoading,
  loadingText = "Sending to agent...",
}: {
  messages?: Message[] | null;
  latencyMs?: number;
  isLoading?: boolean;
  loadingText?: string;
}) {
  if (isLoading) {
    return (
      <div className="run-preview-message run-preview-message-assistant run-preview-simulated">
        <span className="run-preview-role">assistant</span>
        <div className="run-preview-content-text run-preview-loading">
          {loadingText}
        </div>
      </div>
    );
  }

  if (!messages || messages.length === 0) return null;

  // Build tool results map for inline display
  const toolResultsMap = buildToolResultsMap(messages);

  // Filter out tool messages that are shown inline with their tool calls
  const visibleMessages = messages.filter(
    (m) => !isToolResultShownInline(m, toolResultsMap)
  );

  return (
    <>
      {visibleMessages.map((message, index) =>
        isToolCallOnlyMessage(message) ? (
          // Tool-call-only messages: render tool calls directly without assistant wrapper
          <ToolCallsDisplay
            key={index}
            toolCalls={message.tool_calls!}
            toolResults={toolResultsMap}
          />
        ) : (
          <div
            key={index}
            className={`run-preview-message run-preview-message-${message.role} run-preview-simulated`}
          >
            <span className="run-preview-role">{message.role} (response)</span>
            <div className="run-preview-content-text">{getMessageContent(message)}</div>
            {message.tool_calls && message.tool_calls.length > 0 && (
              <ToolCallsDisplay toolCalls={message.tool_calls} toolResults={toolResultsMap} />
            )}
            {index === visibleMessages.length - 1 && latencyMs && (
              <span className="run-preview-latency">{latencyMs}ms</span>
            )}
          </div>
        )
      )}
    </>
  );
}

export function SimulationError({
  error,
  rawResponse,
}: {
  error: string;
  rawResponse?: string;
}) {
  return (
    <div className="run-preview-simulation-error">
      <div>{error}</div>
      {rawResponse && (
        <pre className="run-preview-raw-response">rawResponse<br />{rawResponse}</pre>
      )}
    </div>
  );
}
