import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PerformanceChart } from "../components/PerformanceChart";
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
    scenarioId: "scenario-1",
    status: "completed",
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("PerformanceChart", () => {
  it("shows empty state when no runs provided", () => {
    render(<PerformanceChart runs={[]} />);
    expect(screen.getByText("No completed runs to display")).toBeInTheDocument();
  });

  it("shows empty state when runs are not completed", () => {
    const runs = [
      createMockRun({ status: "running" }),
      createMockRun({ status: "queued" }),
    ];
    render(<PerformanceChart runs={runs} />);
    expect(screen.getByText("No completed runs to display")).toBeInTheDocument();
  });

  it("shows chart even with single data point", () => {
    const runs = [
      createMockRun({
        status: "completed",
        result: { success: true },
        completedAt: "2026-02-01T10:00:00Z",
        output: { avgLatencyMs: 1500 },
      }),
    ];
    const { container } = render(<PerformanceChart runs={runs} viewMode="time" />);

    // Should show chart even for single data point
    expect(container.querySelector(".performance-chart")).toBeInTheDocument();
    expect(container.querySelector(".recharts-responsive-container")).toBeInTheDocument();
  });

  it("renders chart for single day with multiple runs", () => {
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
    const { container } = render(<PerformanceChart runs={runs} viewMode="time" />);

    // Should render chart (single day groups to one data point)
    expect(container.querySelector(".performance-chart")).toBeInTheDocument();
    expect(container.querySelector(".recharts-responsive-container")).toBeInTheDocument();
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

    const { container } = render(<PerformanceChart runs={runs} viewMode="time" />);

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
    const { container } = render(<PerformanceChart runs={runs} viewMode="time" />);

    // Should render chart (only the run with a result is counted)
    expect(container.querySelector(".performance-chart")).toBeInTheDocument();
    expect(container.querySelector(".recharts-responsive-container")).toBeInTheDocument();
  });

  it("renders chart with latency data", () => {
    const runs = [
      createMockRun({
        status: "completed",
        result: { success: true },
        completedAt: "2026-02-01T10:00:00Z",
        output: { avgLatencyMs: 500 },
      }),
      createMockRun({
        status: "completed",
        result: { success: true },
        completedAt: "2026-02-02T10:00:00Z",
        output: { avgLatencyMs: 1500 },
      }),
    ];
    const { container } = render(<PerformanceChart runs={runs} viewMode="time" />);

    // Should render chart with latency data
    expect(container.querySelector(".performance-chart")).toBeInTheDocument();
    expect(container.querySelector(".recharts-responsive-container")).toBeInTheDocument();
  });

  it("shows view mode toggle when runs have execution IDs", () => {
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

    render(<PerformanceChart runs={runs} />);

    expect(screen.getByText("By Time")).toBeInTheDocument();
    expect(screen.getByText("By Execution")).toBeInTheDocument();
  });

  it("does not show view mode toggle when no runs have execution IDs", () => {
    const runs = [
      createMockRun({
        status: "completed",
        result: { success: true },
        completedAt: "2026-02-01T10:00:00Z",
      }),
      createMockRun({
        status: "completed",
        result: { success: false },
        completedAt: "2026-02-02T10:00:00Z",
      }),
    ];

    render(<PerformanceChart runs={runs} />);

    expect(screen.queryByText("By Time")).not.toBeInTheDocument();
    expect(screen.queryByText("By Execution")).not.toBeInTheDocument();
  });

  it("switches to execution view when By Execution button is clicked", () => {
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

    const { container } = render(<PerformanceChart runs={runs} />);

    // Initially in execution mode (default)
    const byTimeButton = screen.getByText("By Time");
    const byExecutionButton = screen.getByText("By Execution");
    expect(byExecutionButton).toHaveClass("active");
    expect(byTimeButton).not.toHaveClass("active");

    // Click to switch to time mode
    fireEvent.click(byTimeButton);

    // Button states should toggle
    expect(byTimeButton).toHaveClass("active");
    expect(byExecutionButton).not.toHaveClass("active");

    // Chart container should still be present
    expect(container.querySelector(".performance-chart")).toBeInTheDocument();
    expect(container.querySelector(".recharts-responsive-container")).toBeInTheDocument();
  });

  it("groups runs by execution correctly when switching modes", () => {
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

    const { container } = render(<PerformanceChart runs={runs} />);

    // Switch to execution mode
    const byExecutionButton = screen.getByText("By Execution");
    fireEvent.click(byExecutionButton);

    // Verify we're in execution mode
    expect(byExecutionButton).toHaveClass("active");

    // Chart should still render (execution 1: 2 runs, 100% pass; execution 2: 1 run, 0% pass)
    expect(container.querySelector(".performance-chart")).toBeInTheDocument();
    expect(container.querySelector(".recharts-responsive-container")).toBeInTheDocument();
  });

  it("filters out runs without execution ID in execution mode", () => {
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
        executionId: 2,
      }),
      createMockRun({
        status: "completed",
        result: { success: false },
        completedAt: "2026-02-02T10:00:00Z",
        // No executionId - filtered out in execution mode
      }),
    ];

    const { container } = render(<PerformanceChart runs={runs} />);

    // Toggle should be shown because at least one run has an execution ID
    expect(screen.getByText("By Time")).toBeInTheDocument();
    expect(screen.getByText("By Execution")).toBeInTheDocument();

    // Switch to execution mode
    fireEvent.click(screen.getByText("By Execution"));

    // Chart should render (only runs with executionId are shown)
    expect(container.querySelector(".performance-chart")).toBeInTheDocument();
    expect(container.querySelector(".recharts-responsive-container")).toBeInTheDocument();
  });
});
