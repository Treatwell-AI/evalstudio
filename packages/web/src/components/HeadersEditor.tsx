export interface HeaderEntry {
  key: string;
  value: string;
}

interface HeadersEditorProps {
  headers: HeaderEntry[];
  onChange: (headers: HeaderEntry[]) => void;
  hint?: string;
}

export function HeadersEditor({ headers, onChange, hint }: HeadersEditorProps) {
  return (
    <div className="form-group">
      <label>Headers</label>
      {hint && <p className="form-hint">{hint}</p>}
      {headers.map((header, index) => (
        <div key={index} className="header-row" style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
          <input
            type="text"
            value={header.key}
            onChange={(e) => {
              const updated = [...headers];
              updated[index] = { ...updated[index], key: e.target.value };
              onChange(updated);
            }}
            placeholder="Header name"
            style={{ flex: 1 }}
          />
          <input
            type="text"
            value={header.value}
            onChange={(e) => {
              const updated = [...headers];
              updated[index] = { ...updated[index], value: e.target.value };
              onChange(updated);
            }}
            placeholder="Value"
            style={{ flex: 1 }}
          />
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={() => onChange(headers.filter((_, i) => i !== index))}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() => onChange([...headers, { key: "", value: "" }])}
        style={{ marginTop: "0.5rem" }}
      >
        + Add Header
      </button>
    </div>
  );
}
