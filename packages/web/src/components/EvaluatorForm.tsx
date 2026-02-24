import { useEvaluatorTypes } from "../hooks/useEvaluatorTypes";
import type { ScenarioEvaluator, EvaluatorTypeInfo } from "../lib/api";

interface EvaluatorFormProps {
  evaluators: ScenarioEvaluator[];
  onChange: (evaluators: ScenarioEvaluator[]) => void;
}

export function EvaluatorForm({ evaluators, onChange }: EvaluatorFormProps) {
  const { data: evaluatorTypes = [], isLoading } = useEvaluatorTypes();

  // Only show auto evaluators if they have configurable fields
  const hasConfigFields = (t: EvaluatorTypeInfo) => {
    const props = (t.configSchema as { properties?: Record<string, unknown> })?.properties;
    return props && Object.keys(props).length > 0;
  };
  const alwaysActiveTypes = evaluatorTypes.filter((t) => t.auto && hasConfigFields(t));

  const handleAdd = (type: string) => {
    // Don't add duplicate types
    if (evaluators.some((e) => e.type === type)) return;
    onChange([...evaluators, { type }]);
  };

  const handleRemove = (index: number) => {
    onChange(evaluators.filter((_, i) => i !== index));
  };

  // Available types = non-alwaysActive types minus already-added ones
  const availableTypes = evaluatorTypes.filter(
    (t) => !t.auto && !evaluators.some((e) => e.type === t.type)
  );

  // Group available types by kind
  const assertions = availableTypes.filter((t) => t.kind === "assertion");
  const metrics = availableTypes.filter((t) => t.kind === "metric");

  const getTypeInfo = (type: string): EvaluatorTypeInfo | undefined =>
    evaluatorTypes.find((t) => t.type === type);

  return (
    <div className="evaluator-form">
      {alwaysActiveTypes.length > 0 && (
        <div className="evaluator-list">
          {alwaysActiveTypes.map((info) => (
            <div key={info.type} className="evaluator-card evaluator-card-auto">
              <div className="evaluator-card-header">
                <div className="evaluator-card-title">
                  <span className="evaluator-card-label">
                    {info.label}
                  </span>
                  <span className={`evaluator-kind-badge ${info.kind}`}>
                    {info.kind}
                  </span>
                </div>
                <span className="evaluator-auto-badge">auto</span>
              </div>
              {info.description && (
                <p className="evaluator-card-description">{info.description}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {evaluators.length > 0 && (
        <div className="evaluator-list">
          {evaluators.map((evaluator, index) => {
            const info = getTypeInfo(evaluator.type);
            return (
              <div key={evaluator.type} className="evaluator-card">
                <div className="evaluator-card-header">
                  <div className="evaluator-card-title">
                    <span className="evaluator-card-label">
                      {info?.label ?? evaluator.type}
                    </span>
                    <span className={`evaluator-kind-badge ${info?.kind ?? "metric"}`}>
                      {info?.kind ?? "unknown"}
                    </span>
                  </div>
                  <button
                    className="evaluator-remove-btn"
                    onClick={() => handleRemove(index)}
                    title="Remove evaluator"
                  >
                    x
                  </button>
                </div>
                {info?.description && (
                  <p className="evaluator-card-description">{info.description}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!isLoading && availableTypes.length > 0 && (
        <div className="evaluator-add-section">
          <select
            className="evaluator-add-select"
            value=""
            onChange={(e) => {
              if (e.target.value) handleAdd(e.target.value);
            }}
          >
            <option value="">+ Add evaluator...</option>
            {metrics.length > 0 && (
              <optgroup label="Metrics">
                {metrics.map((t) => (
                  <option key={t.type} value={t.type}>
                    {t.label}
                  </option>
                ))}
              </optgroup>
            )}
            {assertions.length > 0 && (
              <optgroup label="Assertions">
                {assertions.map((t) => (
                  <option key={t.type} value={t.type}>
                    {t.label}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>
      )}

      {evaluators.length === 0 && alwaysActiveTypes.length === 0 && !isLoading && (
        <p className="form-hint">No evaluators added. Use the dropdown above to add metrics or assertions.</p>
      )}
    </div>
  );
}
