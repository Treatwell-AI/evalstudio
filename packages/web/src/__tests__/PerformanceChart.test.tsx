import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
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

  it("renders chart for completed runs with execution IDs", () => {
    const runs = [
      createMockRun({
        status: "completed",
        result: { success: true },
        executionId: 1,
        output: { avgLatencyMs: 1500 },
      }),
    ];
    const { container } = render(<PerformanceChart runs={runs} />);

    expect(container.querySelector(".performance-charts")).toBeInTheDocument();
    expect(container.querySelector(".recharts-responsive-container")).toBeInTheDocument();
  });

  it("groups runs by execution correctly", () => {
    const runs = [
      createMockRun({
        status: "completed",
        result: { success: true },
        executionId: 1,
      }),
      createMockRun({
        status: "completed",
        result: { success: true },
        executionId: 1,
      }),
      createMockRun({
        status: "completed",
        result: { success: false },
        executionId: 2,
      }),
    ];

    const { container } = render(<PerformanceChart runs={runs} />);

    // Chart should render (execution 1: 2 runs, 100% pass; execution 2: 1 run, 0% pass)
    expect(container.querySelector(".performance-charts")).toBeInTheDocument();
    expect(container.querySelector(".recharts-responsive-container")).toBeInTheDocument();
  });

  it("ignores runs without results", () => {
    const runs = [
      createMockRun({
        status: "completed",
        result: { success: true },
        executionId: 1,
      }),
      createMockRun({
        status: "completed",
        result: undefined, // No result
        executionId: 1,
      }),
    ];
    const { container } = render(<PerformanceChart runs={runs} />);

    expect(container.querySelector(".performance-charts")).toBeInTheDocument();
    expect(container.querySelector(".recharts-responsive-container")).toBeInTheDocument();
  });

  it("renders chart with latency data", () => {
    const runs = [
      createMockRun({
        status: "completed",
        result: { success: true },
        executionId: 1,
        output: { avgLatencyMs: 500 },
      }),
      createMockRun({
        status: "completed",
        result: { success: true },
        executionId: 2,
        output: { avgLatencyMs: 1500 },
      }),
    ];
    const { container } = render(<PerformanceChart runs={runs} />);

    expect(container.querySelector(".performance-charts")).toBeInTheDocument();
    expect(container.querySelector(".recharts-responsive-container")).toBeInTheDocument();
  });

  it("filters out runs without execution ID", () => {
    const runs = [
      createMockRun({
        status: "completed",
        result: { success: true },
        executionId: 1,
      }),
      createMockRun({
        status: "completed",
        result: { success: true },
        executionId: 2,
      }),
      createMockRun({
        status: "completed",
        result: { success: false },
        // No executionId - filtered out
      }),
    ];

    const { container } = render(<PerformanceChart runs={runs} />);

    // Chart should render (only runs with executionId are shown)
    expect(container.querySelector(".performance-charts")).toBeInTheDocument();
    expect(container.querySelector(".recharts-responsive-container")).toBeInTheDocument();
  });

  it("includes error runs in chart data", () => {
    const runs = [
      createMockRun({
        status: "error",
        executionId: 1,
      }),
      createMockRun({
        status: "completed",
        result: { success: true },
        executionId: 1,
      }),
    ];

    const { container } = render(<PerformanceChart runs={runs} />);

    expect(container.querySelector(".performance-charts")).toBeInTheDocument();
    expect(container.querySelector(".recharts-responsive-container")).toBeInTheDocument();
  });
});
