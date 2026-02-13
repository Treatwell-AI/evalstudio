import { useState, useEffect, useCallback } from "react";
import { Message } from "../lib/api";

type EditableRole = "user" | "assistant";

interface SeedMessage {
  role: EditableRole;
  content: string;
}

type EditMode = "visual" | "json";

interface SeedMessagesEditorProps {
  messages: Message[];
  onChange: (messages: Message[]) => void;
}

function toSeedMessages(messages: Message[]): SeedMessage[] {
  return messages.map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: typeof m.content === "string" ? m.content : "",
  }));
}

function fromSeedMessages(seedMessages: SeedMessage[]): Message[] {
  return seedMessages.map((m) => ({
    role: m.role,
    content: m.content,
  }));
}

function autoResize(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}

export function SeedMessagesEditor({ messages, onChange }: SeedMessagesEditorProps) {
  const [editMode, setEditMode] = useState<EditMode>("visual");
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [seedMessages, setSeedMessages] = useState<SeedMessage[]>(() => toSeedMessages(messages));

  // Sync from parent when messages change externally (e.g., on load)
  useEffect(() => {
    setSeedMessages(toSeedMessages(messages));
    setJsonText(JSON.stringify(messages.length > 0 ? messages : [], null, 2));
  }, [messages]);

  const handleSwitchMode = (mode: EditMode) => {
    if (mode === editMode) return;

    if (mode === "json") {
      // Visual -> JSON: serialize current messages
      const exported = fromSeedMessages(seedMessages);
      setJsonText(JSON.stringify(exported.length > 0 ? exported : [], null, 2));
      setJsonError(null);
      setEditMode("json");
    } else {
      // JSON -> Visual: parse JSON
      try {
        const parsed = JSON.parse(jsonText);
        if (!Array.isArray(parsed)) {
          setJsonError("Must be a JSON array");
          return;
        }
        const newMessages = toSeedMessages(parsed);
        setSeedMessages(newMessages);
        onChange(fromSeedMessages(newMessages));
        setJsonError(null);
        setEditMode("visual");
      } catch {
        setJsonError("Invalid JSON — fix errors before switching to visual mode");
      }
    }
  };

  // Visual mode handlers
  const handleAddMessage = () => {
    // Alternate roles: if last message is user, add assistant, and vice versa
    const lastRole = seedMessages.length > 0 ? seedMessages[seedMessages.length - 1].role : "assistant";
    const newRole: EditableRole = lastRole === "user" ? "assistant" : "user";
    const updated = [...seedMessages, { role: newRole, content: "" }];
    setSeedMessages(updated);
    onChange(fromSeedMessages(updated));
  };

  const handleRemoveMessage = (index: number) => {
    const updated = seedMessages.filter((_, i) => i !== index);
    setSeedMessages(updated);
    onChange(fromSeedMessages(updated));
  };

  const handleUpdateRole = (index: number, role: EditableRole) => {
    const updated = seedMessages.map((m, i) => (i === index ? { ...m, role } : m));
    setSeedMessages(updated);
    onChange(fromSeedMessages(updated));
  };

  const handleUpdateContent = (index: number, content: string, el: HTMLTextAreaElement) => {
    const updated = seedMessages.map((m, i) => (i === index ? { ...m, content } : m));
    setSeedMessages(updated);
    onChange(fromSeedMessages(updated));
    autoResize(el);
  };

  // Auto-resize textarea on mount / when content changes externally
  const textareaRef = useCallback((el: HTMLTextAreaElement | null) => {
    if (el) autoResize(el);
  }, [seedMessages]);

  // JSON mode handler
  const handleJsonChange = (text: string) => {
    setJsonText(text);
    setJsonError(null);
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        onChange(parsed);
      }
    } catch {
      // Don't update parent while JSON is invalid — user is still typing
    }
  };

  return (
    <div className="seed-messages-editor">
      <div className="seed-messages-header">
        <label>Initial Messages (optional)</label>
        <div className="seed-messages-mode-toggle">
          <button
            type="button"
            className={`seed-messages-mode-btn ${editMode === "visual" ? "active" : ""}`}
            onClick={() => handleSwitchMode("visual")}
          >
            Visual
          </button>
          <button
            type="button"
            className={`seed-messages-mode-btn ${editMode === "json" ? "active" : ""}`}
            onClick={() => handleSwitchMode("json")}
          >
            JSON
          </button>
        </div>
      </div>
      <p className="form-hint">
        Seed the conversation with prior messages to test mid-conversation scenarios.
      </p>

      {jsonError && <div className="seed-messages-error">{jsonError}</div>}

      {editMode === "visual" ? (
        <div className="seed-messages-visual">
          {seedMessages.length === 0 ? (
            <div className="seed-messages-empty">
              No initial messages. Click "Add Message" to seed the conversation.
            </div>
          ) : (
            <div className="seed-messages-list">
              {seedMessages.map((msg, index) => (
                <div key={index} className={`seed-message-item seed-message-${msg.role}`}>
                  <div className="seed-message-header">
                    <button
                      type="button"
                      className="seed-message-role-toggle"
                      onClick={() => handleUpdateRole(index, msg.role === "user" ? "assistant" : "user")}
                      title="Click to switch role"
                    >
                      {msg.role}
                    </button>
                    <button
                      type="button"
                      className="seed-message-remove-btn"
                      onClick={() => handleRemoveMessage(index)}
                      aria-label="Remove message"
                      title="Remove message"
                    >
                      <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 4l8 8M12 4l-8 8" />
                      </svg>
                    </button>
                  </div>
                  <textarea
                    ref={textareaRef}
                    value={msg.content}
                    onChange={(e) => handleUpdateContent(index, e.target.value, e.target)}
                    placeholder={msg.role === "user" ? "User message..." : "Assistant response..."}
                    className="seed-message-content"
                  />
                </div>
              ))}
            </div>
          )}
          <button
            type="button"
            className="seed-messages-add-btn"
            onClick={handleAddMessage}
          >
            + Add Message
          </button>
        </div>
      ) : (
        <div className="seed-messages-json">
          <textarea
            value={jsonText}
            onChange={(e) => handleJsonChange(e.target.value)}
            rows={8}
            className="code-textarea"
            placeholder='[{"role": "user", "content": "Hello"}, {"role": "assistant", "content": "Hi there!"}]'
          />
        </div>
      )}
    </div>
  );
}