import { useMemo, useState } from "react";
import {
  Line,
  LineChart,
  ComposedChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { Run, EvaluatorResultEntry } from "../lib/api";
import { RunMessagesModal } from "./RunMessagesModal";

type ViewMode = "time" | "execution";

interface PerformanceChartProps {
  runs: Run[];
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  showToggle?: boolean;
}

interface ChartDataPoint {
  label: string;
  timestamp?: number;
  passRate: number;
  avgLatency: number;
  avgOutputTokens: number;
  totalRuns: number;
  passedRuns: number;
  passedPercent: number;
}

interface LatencyScatterPoint {
  x: number;
  latency: number;
  runId: string;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatLatency(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTokens(tokens: number): string {
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}k`;
  }
  return `${Math.round(tokens)}`;
}

function getOutputTokens(run: Run): number | undefined {
  const output = run.output as Record<string, unknown> | undefined;
  const evaluatorResults = output?.evaluatorResults as EvaluatorResultEntry[] | undefined;
  const tokenEval = evaluatorResults?.find((r) => r.type === "token-usage");
  const usage = tokenEval?.metadata as { output_tokens?: number } | undefined;
  return usage?.output_tokens;
}

function formatExecutionId(executionId: number): string {
  return `#${executionId}`;
}

function groupRunsByDate(completedRuns: Run[]): ChartDataPoint[] {
  const runsByDate = new Map<string, Run[]>();

  for (const run of completedRuns) {
    const dateKey = run.completedAt
      ? new Date(run.completedAt).toISOString().split("T")[0]
      : new Date(run.createdAt).toISOString().split("T")[0];

    const existing = runsByDate.get(dateKey) || [];
    existing.push(run);
    runsByDate.set(dateKey, existing);
  }

  return Array.from(runsByDate.entries())
    .map(([dateKey, dateRuns]) => {
      const passedRuns = dateRuns.filter((r) => r.result?.success).length;
      const totalRuns = dateRuns.length;
      const passRate = totalRuns > 0 ? (passedRuns / totalRuns) * 100 : 0;

      const latencies = dateRuns
        .map((r) => r.output?.avgLatencyMs as number | undefined)
        .filter((l): l is number => typeof l === "number" && l > 0);
      const avgLatency =
        latencies.length > 0
          ? latencies.reduce((sum, l) => sum + l, 0) / latencies.length
          : 0;

      const outputTokens = dateRuns
        .map(getOutputTokens)
        .filter((t): t is number => typeof t === "number" && t > 0);
      const avgOutputTokens =
        outputTokens.length > 0
          ? outputTokens.reduce((sum, t) => sum + t, 0) / outputTokens.length
          : 0;

      return {
        label: formatDate(dateKey),
        timestamp: new Date(dateKey).getTime(),
        passRate: Math.round(passRate * 10) / 10,
        avgLatency: Math.round(avgLatency),
        avgOutputTokens: Math.round(avgOutputTokens),
        totalRuns,
        passedRuns,
        passedPercent: totalRuns > 0 ? Math.round((passedRuns / totalRuns) * 100 * 10) / 10 : 0,
      };
    })
    .sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
}

function groupRunsByExecution(completedRuns: Run[]): ChartDataPoint[] {
  // Filter out runs without executionId
  const runsWithExecution = completedRuns.filter((run) => run.executionId != null);
  const runsByExecution = new Map<number, Run[]>();

  for (const run of runsWithExecution) {
    const executionKey = run.executionId!;
    const existing = runsByExecution.get(executionKey) || [];
    existing.push(run);
    runsByExecution.set(executionKey, existing);
  }

  // Sort executions by ID (ascending)
  const sortedExecutions = Array.from(runsByExecution.entries()).sort((a, b) => a[0] - b[0]);

  return sortedExecutions.map(([executionKey, executionRuns]) => {
    const passedRuns = executionRuns.filter((r) => r.result?.success).length;
    const totalRuns = executionRuns.length;
    const passRate = totalRuns > 0 ? (passedRuns / totalRuns) * 100 : 0;

    const latencies = executionRuns
      .map((r) => r.output?.avgLatencyMs as number | undefined)
      .filter((l): l is number => typeof l === "number" && l > 0);
    const avgLatency =
      latencies.length > 0
        ? latencies.reduce((sum, l) => sum + l, 0) / latencies.length
        : 0;

    const outputTokens = executionRuns
      .map(getOutputTokens)
      .filter((t): t is number => typeof t === "number" && t > 0);
    const avgOutputTokens =
      outputTokens.length > 0
        ? outputTokens.reduce((sum, t) => sum + t, 0) / outputTokens.length
        : 0;

    return {
      label: formatExecutionId(executionKey),
      passRate: Math.round(passRate * 10) / 10,
      avgLatency: Math.round(avgLatency),
      avgOutputTokens: Math.round(avgOutputTokens),
      totalRuns,
      passedRuns,
      passedPercent: totalRuns > 0 ? Math.round((passedRuns / totalRuns) * 100 * 10) / 10 : 0,
    };
  });
}

export function PerformanceChart({
  runs,
  viewMode: externalViewMode,
  onViewModeChange,
  showToggle = true,
}: PerformanceChartProps) {
  const [internalViewMode, setInternalViewMode] = useState<ViewMode>("execution");
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  // Use external viewMode if provided, otherwise use internal state
  const viewMode = externalViewMode ?? internalViewMode;
  const setViewMode = onViewModeChange ?? setInternalViewMode;

  // Check if any runs have execution IDs set
  const hasExecutionData = useMemo(() => {
    return runs.some((run) => run.executionId);
  }, [runs]);

  const chartData = useMemo(() => {
    // Include completed runs (with results) and error runs
    const completedRuns = runs.filter(
      (run) => (run.status === "completed" && run.result !== undefined) || run.status === "error"
    );

    if (completedRuns.length === 0) {
      return [];
    }

    const grouped = viewMode === "time"
      ? groupRunsByDate(completedRuns)
      : groupRunsByExecution(completedRuns);

    return grouped.slice(-20);
  }, [runs, viewMode]);

  const latencyChartData = useMemo(() => {
    const completedRuns = runs.filter(
      (run) => (run.status === "completed" && run.result !== undefined) || run.status === "error"
    );
    if (completedRuns.length === 0 || chartData.length === 0) {
      return { lineData: [] as { x: number; avgLatency: number }[], scatterData: [] as LatencyScatterPoint[], labels: [] as string[] };
    }

    // Use last 10 groups
    const last10 = chartData.slice(-10);
    const labelSet = new Set(last10.map((d) => d.label));

    const lineData = last10.map((d, i) => ({
      x: i,
      avgLatency: d.avgLatency,
    }));

    const labelToIndex = new Map(last10.map((d, i) => [d.label, i]));
    const scatterPoints: LatencyScatterPoint[] = [];

    for (const run of completedRuns) {
      const latency = run.output?.avgLatencyMs as number | undefined;
      if (typeof latency !== "number" || latency <= 0) continue;

      let label: string;
      if (viewMode === "execution") {
        if (run.executionId == null) continue;
        label = formatExecutionId(run.executionId);
      } else {
        const dateKey = run.completedAt
          ? new Date(run.completedAt).toISOString().split("T")[0]
          : new Date(run.createdAt).toISOString().split("T")[0];
        label = formatDate(dateKey);
      }

      if (!labelSet.has(label)) continue;
      const idx = labelToIndex.get(label)!;
      scatterPoints.push({ x: idx, latency: Math.round(latency), runId: run.id });
    }

    return { lineData, scatterData: scatterPoints, labels: last10.map((d) => d.label) };
  }, [runs, viewMode, chartData]);

  if (chartData.length === 0) {
    return (
      <div className="performance-chart-empty">
        <p>No completed runs to display</p>
      </div>
    );
  }

  const isExecutionMode = viewMode === "execution";

  return (
    <div className="performance-chart">
      {showToggle && hasExecutionData && (
        <div className="performance-chart-toggle">
          <button
            className={`performance-chart-toggle-btn ${viewMode === "time" ? "active" : ""}`}
            onClick={() => setViewMode("time")}
          >
            By Time
          </button>
          <button
            className={`performance-chart-toggle-btn ${viewMode === "execution" ? "active" : ""}`}
            onClick={() => setViewMode("execution")}
          >
            By Execution
          </button>
        </div>
      )}
      <div className="performance-chart-row">
        <ResponsiveContainer width="62%" height={200}>
          <LineChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 12, fill: "#64748b" }}
              tickLine={{ stroke: "#e2e8f0" }}
              axisLine={{ stroke: "#e2e8f0" }}
            />
            <YAxis
              yAxisId="percent"
              domain={[0, 100]}
              tick={{ fontSize: 12, fill: "#64748b" }}
              tickLine={{ stroke: "#e2e8f0" }}
              axisLine={{ stroke: "#e2e8f0" }}
              tickFormatter={(value) => `${value}%`}
              width={50}
            />
            <YAxis
              yAxisId="tokens"
              orientation="right"
              tick={{ fontSize: 12, fill: "#64748b" }}
              tickLine={{ stroke: "#e2e8f0" }}
              axisLine={{ stroke: "#e2e8f0" }}
              tickFormatter={(value) => formatTokens(value)}
              width={60}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              formatter={(value, name, props) => {
                if (typeof value !== "number") return [String(value), name];
                if (name === "Output Tokens") {
                  return [formatTokens(value), name];
                }
                const payload = props.payload as ChartDataPoint;
                if (name === "Passed") {
                  return [`${value}% (${payload.passedRuns})`, name];
                }
                return [value, name];
              }}
              labelFormatter={(label) => `${isExecutionMode ? "Execution" : "Date"}: ${label}`}
            />
            <Legend verticalAlign="top" wrapperStyle={{ fontSize: "12px", paddingBottom: "8px" }} />
            <Line
              yAxisId="percent"
              type="monotone"
              dataKey="passedPercent"
              name="Passed"
              stroke="#22c55e"
              strokeWidth={2}
              dot={{ fill: "#22c55e", strokeWidth: 0, r: 4 }}
              activeDot={{ r: 6 }}
            />
            <Line
              yAxisId="tokens"
              type="monotone"
              dataKey="avgOutputTokens"
              name="Output Tokens"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={{ fill: "#f59e0b", strokeWidth: 0, r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>

        <ResponsiveContainer width="38%" height={200}>
          <ComposedChart
            data={latencyChartData.lineData}
            margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="x"
              type="number"
              domain={[0, Math.max(latencyChartData.labels.length - 1, 0)]}
              ticks={latencyChartData.labels.map((_, i) => i)}
              tickFormatter={(i) => latencyChartData.labels[i] ?? ""}
              tick={{ fontSize: 12, fill: "#64748b" }}
              tickLine={{ stroke: "#e2e8f0" }}
              axisLine={{ stroke: "#e2e8f0" }}
            />
            <YAxis
              orientation="right"
              tick={{ fontSize: 12, fill: "#64748b" }}
              tickLine={{ stroke: "#e2e8f0" }}
              axisLine={{ stroke: "#e2e8f0" }}
              tickFormatter={(value) => formatLatency(value)}
              width={50}
            />
            <Tooltip content={() => null} cursor={false} />
            <Legend verticalAlign="top" wrapperStyle={{ fontSize: "12px", paddingBottom: "8px" }} />
            <Scatter
              data={latencyChartData.scatterData}
              dataKey="latency"
              name="Run Latency"
              fill="#3b82f6"
              cursor="pointer"
              onClick={(data) => {
                const point = data as unknown as LatencyScatterPoint;
                if (point.runId) setSelectedRunId(point.runId);
              }}
            />
            <Line
              type="monotone"
              dataKey="avgLatency"
              name="Avg Latency"
              stroke="#ef4444"
              strokeWidth={2}
              dot={false}
              activeDot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {selectedRunId && (
        <RunMessagesModal
          runId={selectedRunId}
          onClose={() => setSelectedRunId(null)}
        />
      )}
    </div>
  );
}
