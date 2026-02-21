import { useState, useEffect } from "react";
import { useProjectConfig, useUpdateProjectConfig } from "../hooks/useProjects";
import { StyleReferenceManager } from "../components/StyleReferenceManager";

export function SettingsGeneralPage() {
  const { data: projectConfig } = useProjectConfig();
  const updateProjectConfig = useUpdateProjectConfig();

  const [projectName, setProjectName] = useState("");
  const [maxConcurrency, setMaxConcurrency] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (projectConfig) {
      setProjectName(projectConfig.name || "");
      setMaxConcurrency(
        projectConfig.maxConcurrency !== undefined
          ? String(projectConfig.maxConcurrency)
          : ""
      );
    }
  }, [projectConfig]);

  const handleSave = async () => {
    setSaveSuccess(false);

    const concurrencyValue = maxConcurrency.trim();
    const parsedConcurrency = concurrencyValue ? parseInt(concurrencyValue, 10) : null;

    if (concurrencyValue && (isNaN(parsedConcurrency as number) || (parsedConcurrency as number) < 1)) {
      return;
    }

    const trimmedName = projectName.trim();
    if (!trimmedName) {
      return;
    }

    try {
      await updateProjectConfig.mutateAsync({
        name: trimmedName,
        maxConcurrency: parsedConcurrency,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Failed to save settings:", error);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>General</h1>
      </div>

      <div className="llm-config-section">
        <h2>Project</h2>
        <p>
          Basic project information.
        </p>

        <div className="settings-subsection">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="project-name">Project Name</label>
              <input
                id="project-name"
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="llm-config-section">
        <h2>Run Execution</h2>
        <p>
          Configure how evaluation runs are processed.
        </p>

        <div className="settings-subsection">
          <h3>Concurrency</h3>
          <p>
            Controls how many evaluation runs execute in parallel.
          </p>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="max-concurrency">Max Concurrent Runs</label>
              <input
                id="max-concurrency"
                type="number"
                min="1"
                max="50"
                placeholder="3 (default)"
                value={maxConcurrency}
                onChange={(e) => setMaxConcurrency(e.target.value)}
              />
              <span className="form-hint">
                Higher values speed up execution but use more resources.
              </span>
            </div>
          </div>
        </div>
      </div>

      <StyleReferenceManager />

      <div className="form-actions">
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={updateProjectConfig.isPending}
        >
          {updateProjectConfig.isPending ? "Saving..." : "Save"}
        </button>
        {saveSuccess && <span className="save-success">Settings saved!</span>}
        {updateProjectConfig.isError && (
          <span className="save-error">
            Error: {(updateProjectConfig.error as Error)?.message}
          </span>
        )}
      </div>
    </div>
  );
}
