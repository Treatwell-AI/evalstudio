import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DashboardPerformanceChart } from "../components/DashboardPerformanceChart";
import { Run } from "../lib/api";

// Mock ResizeObserver for Recharts ResponsiveContainer
class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserver;

function createMockRun(overrides: Partial<Run> = {}): Run {
  return {
    id: `run-${Math.random().toString(36).slice(2)}`,
    projectId: "project-1",
    scenarioId: "scenario-1",
    status: "completed",
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("DashboardPerformanceChart", () => {
  it("shows empty state when no runs provided", () => {
    render(<DashboardPerformanceChart runs={[]} />);
    expect(screen.getByText("No completed runs to display")).toBeInTheDocument();
  });

  it("shows empty state when runs are not completed", () => {
    const runs = [
      createMockRun({ status: "running" }),
      createMockRun({ status: "queued" }),
    ];
    render(<DashboardPerformanceChart runs={runs} />);
    expect(screen.getByText("No completed runs to display")).toBeInTheDocument();
  });

  it("shows single stat view when only one data point exists", () => {
    const runs = [
      createMockRun({
        status: "completed",
        result: { success: true },
        completedAt: "2026-02-01T10:00:00Z",
        output: { avgLatencyMs: 1500 },
      }),
    ];
    render(<DashboardPerformanceChart runs={runs} />);

    // Should show stats instead of chart for single data point
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.getByText("Pass Rate")).toBeInTheDocument();
    expect(screen.getByText("Avg Latency")).toBeInTheDocument();
    expect(screen.getByText("Total Runs")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("calculates pass rate correctly", () => {
    const runs = [
      createMockRun({
        status: "completed",
        result: { success: true },
        completedAt: "2026-02-01T10:00:00Z",
      }),
      createMockRun({
        status: "completed",
        result: { success: false },
        completedAt: "2026-02-01T11:00:00Z",
      }),
    ];
    render(<DashboardPerformanceChart runs={runs} />);

    // 1 pass, 1 fail = 50% pass rate (single day, so stats view)
    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  it("renders chart when multiple days of data exist", () => {
    const runs = [
      createMockRun({
        status: "completed",
        result: { success: true },
        completedAt: "2026-02-01T10:00:00Z",
        output: { avgLatencyMs: 1000 },
      }),
      createMockRun({
        status: "completed",
        result: { success: true },
        completedAt: "2026-02-02T10:00:00Z",
        output: { avgLatencyMs: 2000 },
      }),
    ];

    const { container } = render(<DashboardPerformanceChart runs={runs} />);

    // Should render the chart container
    expect(container.querySelector(".performance-chart")).toBeInTheDocument();
    // Recharts renders SVG elements
    expect(container.querySelector(".recharts-responsive-container")).toBeInTheDocument();
  });

  it("ignores runs without results", () => {
    const runs = [
      createMockRun({
        status: "completed",
        result: { success: true },
        completedAt: "2026-02-01T10:00:00Z",
      }),
      createMockRun({
        status: "completed",
        result: undefined, // No result
        completedAt: "2026-02-01T11:00:00Z",
      }),
    ];
    render(<DashboardPerformanceChart runs={runs} />);

    // Should only count the run with a result
    expect(screen.getByText("1")).toBeInTheDocument(); // Total runs
    expect(screen.getByText("100%")).toBeInTheDocument(); // Pass rate
  });

  it("formats latency correctly in stats view", () => {
    const runs = [
      createMockRun({
        status: "completed",
        result: { success: true },
        completedAt: "2026-02-01T10:00:00Z",
        output: { avgLatencyMs: 500 },
      }),
    ];
    render(<DashboardPerformanceChart runs={runs} />);
    expect(screen.getByText("500ms")).toBeInTheDocument();
  });

  it("formats latency in seconds when >= 1000ms", () => {
    const runs = [
      createMockRun({
        status: "completed",
        result: { success: true },
        completedAt: "2026-02-01T10:00:00Z",
        output: { avgLatencyMs: 2500 },
      }),
    ];
    render(<DashboardPerformanceChart runs={runs} />);
    expect(screen.getByText("2.5s")).toBeInTheDocument();
  });

  it("renders title when provided", () => {
    const runs = [
      createMockRun({
        status: "completed",
        result: { success: true },
        completedAt: "2026-02-01T10:00:00Z",
      }),
    ];

    render(<DashboardPerformanceChart runs={runs} title="Performance Overview" />);

    expect(screen.getByText("Performance Overview")).toBeInTheDocument();
  });

  it("renders bar chart in execution mode with multiple executions", () => {
    const runs = [
      createMockRun({
        status: "completed",
        result: { success: true },
        completedAt: "2026-02-01T10:00:00Z",
        executionId: 1,
      }),
      createMockRun({
        status: "completed",
        result: { success: false },
        completedAt: "2026-02-02T10:00:00Z",
        executionId: 2,
      }),
    ];

    const { container } = render(
      <DashboardPerformanceChart runs={runs} viewMode="execution" />
    );

    expect(container.querySelector(".performance-chart")).toBeInTheDocument();
    expect(container.querySelector(".recharts-responsive-container")).toBeInTheDocument();
  });

  it("groups runs by execution correctly", () => {
    const runs = [
      createMockRun({
        status: "completed",
        result: { success: true },
        completedAt: "2026-02-01T10:00:00Z",
        executionId: 1,
      }),
      createMockRun({
        status: "completed",
        result: { success: true },
        completedAt: "2026-02-01T11:00:00Z",
        executionId: 1,
      }),
      createMockRun({
        status: "completed",
        result: { success: false },
        completedAt: "2026-02-02T10:00:00Z",
        executionId: 2,
      }),
    ];

    const { container } = render(
      <DashboardPerformanceChart runs={runs} viewMode="execution" />
    );

    // Chart should render with execution grouping
    expect(container.querySelector(".performance-chart")).toBeInTheDocument();
    expect(container.querySelector(".recharts-responsive-container")).toBeInTheDocument();
  });
});
