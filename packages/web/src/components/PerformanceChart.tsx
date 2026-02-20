import { useMemo, useState } from "react";
import {
  Line,
  LineChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Run } from "../lib/api";

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
  totalRuns: number;
  passedRuns: number;
  passedPercent: number;
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

      return {
        label: formatDate(dateKey),
        timestamp: new Date(dateKey).getTime(),
        passRate: Math.round(passRate * 10) / 10,
        avgLatency: Math.round(avgLatency),
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

    return {
      label: formatExecutionId(executionKey),
      passRate: Math.round(passRate * 10) / 10,
      avgLatency: Math.round(avgLatency),
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
      <ResponsiveContainer width="100%" height={200}>
        <LineChart
          data={chartData}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
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
            yAxisId="latency"
            orientation="right"
            tick={{ fontSize: 12, fill: "#64748b" }}
            tickLine={{ stroke: "#e2e8f0" }}
            axisLine={{ stroke: "#e2e8f0" }}
            tickFormatter={(value) => formatLatency(value)}
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
              if (name === "Avg Latency") {
                return [formatLatency(value), name];
              }
              const payload = props.payload as ChartDataPoint;
              if (name === "Passed") {
                return [`${value}% (${payload.passedRuns})`, name];
              }
              return [value, name];
            }}
            labelFormatter={(label) => `${isExecutionMode ? "Execution" : "Date"}: ${label}`}
          />
          <Legend wrapperStyle={{ fontSize: "12px" }} />
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
            yAxisId="latency"
            type="monotone"
            dataKey="avgLatency"
            name="Avg Latency"
            stroke="#6366f1"
            strokeWidth={2}
            dot={{ fill: "#6366f1", strokeWidth: 0, r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
