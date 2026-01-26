import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("status command", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it("statusCommand is exported", async () => {
    const { statusCommand } = await import("../commands/status.js");
    expect(statusCommand).toBeDefined();
    expect(statusCommand.name()).toBe("status");
  });
});
