import { useMemo, useState } from "react";
import { useEval } from "../hooks/useEvals";
import { useCreateRun } from "../hooks/useRuns";
import { useScenarios } from "../hooks/useScenarios";

interface CreateRunDialogProps {
  evalId: string;
  projectId: string;
  onClose: () => void;
}

export function CreateRunDialog({ evalId, projectId, onClose }: CreateRunDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const createRun = useCreateRun();

  // Fetch eval and scenarios to determine how many runs will be created
  const { data: evalData, isLoading: evalLoading } = useEval(evalId);
  const { data: allScenarios, isLoading: scenariosLoading } = useScenarios(projectId);

  const isLoadingData = evalLoading || scenariosLoading;

  const runCount = useMemo(() => {
    if (!evalData?.scenarioIds || !allScenarios) return null;
    // Calculate total runs: sum of persona counts per scenario (or 1 if no personas)
    let total = 0;
    for (const scenarioId of evalData.scenarioIds) {
      const scenario = allScenarios.find(s => s.id === scenarioId);
      // Count persona runs for this scenario (1 if no personas or scenario not found)
      total += scenario?.personaIds?.length || 1;
    }
    return total || 1;
  }, [evalData, allScenarios]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      await createRun.mutateAsync({ evalId });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create run");
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Create New Run</h3>

        <form onSubmit={handleSubmit}>
          {error && <div className="form-error">{error}</div>}

          <div className="form-info">
            <p>
              {isLoadingData ? (
                <>Calculating runs...</>
              ) : runCount && runCount > 1 ? (
                <>
                  <strong>{runCount} runs</strong> will be created (one per
                  scenario/persona combination) in <strong>queued</strong> status.
                </>
              ) : (
                <>
                  The run will be created in <strong>queued</strong> status.
                </>
              )}{" "}
              Uses the connector and LLM provider configured on this eval.
            </p>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={createRun.isPending || isLoadingData}
            >
              {createRun.isPending
                ? "Creating..."
                : isLoadingData
                  ? "Loading..."
                  : runCount && runCount > 1
                    ? `Create ${runCount} Runs`
                    : "Create Run"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
