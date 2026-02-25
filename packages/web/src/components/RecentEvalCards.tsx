import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ExecutionMetrics, useExecutionDataBuilder } from "./ExecutionSummary";
import type { ExecutionData } from "./ExecutionSummary";
import { useEvals } from "../hooks/useEvals";
import { useRuns } from "../hooks/useRuns";

function formatTime(ts: number | null): string {
  if (!ts) return "";
  return new Date(ts).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface CardData {
  evalId: string;
  evalName: string;
  summary: ExecutionData;
}

export function RecentEvalCards() {
  const { data: evals } = useEvals();
  const { data: allRuns = [] } = useRuns();
  const buildExec = useExecutionDataBuilder();

  const cards = useMemo<CardData[]>(() => {
    if (!evals || allRuns.length === 0) return [];

    const evalMap = new Map(evals.map((e) => [e.id, e]));

    // Group runs by evalId
    const runsByEval = new Map<string, typeof allRuns>();
    for (const run of allRuns) {
      if (!run.evalId) continue;
      const list = runsByEval.get(run.evalId) ?? [];
      list.push(run);
      runsByEval.set(run.evalId, list);
    }

    const results: CardData[] = [];
    for (const [evalId, evalRuns] of runsByEval) {
      const ev = evalMap.get(evalId);
      if (!ev) continue;

      // Find latest executionId with finished runs
      const runsWithExec = evalRuns.filter((r) => r.executionId != null);
      const latestId = [...new Set(runsWithExec.map((r) => r.executionId!))]
        .sort((a, b) => a - b)
        .filter((id) =>
          runsWithExec.some(
            (r) => r.executionId === id && (r.status === "completed" || r.status === "error")
          )
        )
        .at(-1);
      if (latestId == null) continue;

      const summary = buildExec(latestId, evalRuns);
      if (!summary) continue;

      results.push({ evalId, evalName: ev.name, summary });
    }

    results.sort((a, b) => (b.summary.executionStart ?? 0) - (a.summary.executionStart ?? 0));
    return results.slice(0, 4);
  }, [evals, allRuns, buildExec]);

  if (cards.length === 0) return null;

  return (
    <div className="recent-eval-cards-grid">
      {cards.map((card) => (
        <div key={card.evalId} className="recent-eval-card">
          <div className="recent-eval-card-header">
            <div className="recent-eval-card-title">
              <Link to={`evals/${card.evalId}`} className="recent-eval-card-link">
                <h3>{card.evalName}</h3>
                <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 4l4 4-4 4" />
                </svg>
              </Link>
              <span className="recent-eval-card-time">{formatTime(card.summary.executionStart)}</span>
            </div>
            <div className="recent-eval-card-subtitle">
              Last Evaluation (#{card.summary.executionId})
              {card.summary.connectorName ? ` — ${card.summary.connectorName}` : ""}
            </div>
          </div>

          <div className="recent-eval-card-body">
            <ExecutionMetrics summary={card.summary} />
          </div>
        </div>
      ))}
    </div>
  );
}
