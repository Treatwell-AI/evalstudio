import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { EntityRedirect } from "../components/EntityRedirect";
import { useScenarios, useCreateScenario } from "../hooks/useScenarios";
import { CreateScenarioInput } from "../lib/api";

export function ScenariosPage() {
  const navigate = useNavigate();
  const { data: scenarios, isLoading } = useScenarios();
  const createScenario = useCreateScenario();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [importReport, setImportReport] = useState<{
    total: number;
    results: { name: string; ok: boolean; error?: string }[];
    loading?: boolean;
  } | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    try {
      const scenario = await createScenario.mutateAsync({
        name: name.trim(),
      });
      setShowCreateModal(false);
      setName("");
      navigate(scenario.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  const handleClose = () => {
    setShowCreateModal(false);
    setName("");
    setError(null);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (fileInputRef.current) fileInputRef.current.value = "";

    try {
      const text = await file.text();
      const lines = text.split("\n").filter((line) => line.trim());
      const results: { name: string; ok: boolean; error?: string }[] = [];

      setImportReport({ total: lines.length, results: [], loading: true });

      for (let i = 0; i < lines.length; i++) {
        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(lines[i]);
        } catch {
          results.push({ name: `Line ${i + 1}`, ok: false, error: "Invalid JSON" });
          continue;
        }

        if (!parsed.name || typeof parsed.name !== "string") {
          results.push({ name: `Line ${i + 1}`, ok: false, error: "Missing \"name\" field" });
          continue;
        }

        const input: CreateScenarioInput = {
          name: parsed.name,
          instructions: typeof parsed.instructions === "string" ? parsed.instructions : undefined,
          messages: Array.isArray(parsed.messages) ? parsed.messages : undefined,
          successCriteria: typeof parsed.successCriteria === "string" ? parsed.successCriteria : undefined,
          failureCriteria: typeof parsed.failureCriteria === "string" ? parsed.failureCriteria : undefined,
          failureCriteriaMode:
            parsed.failureCriteriaMode === "every_turn" || parsed.failureCriteriaMode === "on_max_messages"
              ? parsed.failureCriteriaMode
              : undefined,
        };

        try {
          await createScenario.mutateAsync(input);
          results.push({ name: parsed.name, ok: true });
        } catch (err) {
          results.push({ name: parsed.name, ok: false, error: err instanceof Error ? err.message : "Failed to create" });
        }
      }

      setImportReport({ total: lines.length, results });
    } catch {
      setImportReport({ total: 0, results: [{ name: "File", ok: false, error: "Failed to read file" }] });
    }
  };

  const fallback = (
    <div className="page">
      <div className="page-header">
        <h1>Scenarios</h1>
        <div className="page-header-actions">
          <button
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            + New Scenario
          </button>
          <div className="menu-container">
            <button
              className="menu-btn"
              onClick={() => setShowMenu(!showMenu)}
              aria-label="Scenario actions"
            >
              <span className="dots-icon">...</span>
            </button>
            {showMenu && (
              <>
                <div
                  className="menu-backdrop"
                  onClick={() => setShowMenu(false)}
                />
                <div className="menu-dropdown">
                  <button
                    className="menu-item"
                    onClick={() => {
                      setShowMenu(false);
                      fileInputRef.current?.click();
                    }}
                  >
                    <svg className="menu-item-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10v4h10v-4" /><path d="M8 2v8" /><path d="M5 7l3 3 3-3" /></svg>
                    Import JSONL
                  </button>
                </div>
              </>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".jsonl"
            onChange={handleImport}
            style={{ display: "none" }}
          />
        </div>
      </div>

      {importReport && (() => {
        const created = importReport.results.filter((r) => r.ok).length;
        const failed = importReport.results.filter((r) => !r.ok).length;
        return (
          <div className={`import-report ${importReport.loading ? "" : failed > 0 ? "import-report-warning" : "import-report-success"}`}>
            <div className="import-report-header">
              <span className="import-report-title">
                {importReport.loading ? "Importing..." : "Import complete"}
              </span>
              {!importReport.loading && (
                <button
                  className="import-report-dismiss"
                  onClick={() => setImportReport(null)}
                  aria-label="Dismiss"
                >
                  x
                </button>
              )}
            </div>
            {!importReport.loading && (
              <>
                <div className="import-report-stats">
                  <span className="import-report-stat import-report-stat-total">{importReport.total} found</span>
                  <span className="import-report-stat import-report-stat-created">{created} created</span>
                  {failed > 0 && (
                    <span className="import-report-stat import-report-stat-failed">{failed} failed</span>
                  )}
                </div>
                <ul className="import-report-results">
                  {importReport.results.map((r, i) => (
                    <li key={i} className={r.ok ? "import-result-ok" : "import-result-error"}>
                      <span className="import-result-icon">{r.ok ? "+" : "x"}</span>
                      <span className="import-result-name">{r.name}</span>
                      {r.error && <span className="import-result-error-msg">{r.error}</span>}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        );
      })()}

      <div className="empty-state">
        <p>No scenarios yet. Create a scenario to define test situations.</p>
      </div>

      {showCreateModal && (
        <div className="modal-overlay" onClick={handleClose}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Create Scenario</h3>
            <form onSubmit={handleCreate}>
              {error && <div className="form-error">{error}</div>}
              <div className="form-group">
                <label htmlFor="scenario-name">Name</label>
                <input
                  id="scenario-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Booking Cancellation Request"
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
                  disabled={createScenario.isPending}
                >
                  {createScenario.isPending ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <EntityRedirect
      entityType="scenario"
      items={scenarios}
      isLoading={isLoading}
      fallback={fallback}
    />
  );
}
