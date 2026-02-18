import { describe, it, expect } from "vitest";
import { getStatus } from "../status.js";

describe("getStatus", () => {
  it("returns status object with correct structure", () => {
    const status = getStatus();

    expect(status).toHaveProperty("name", "evalstudio");
    expect(status).toHaveProperty("version");
    expect(status.version).toMatch(/^\d+\.\d+\.\d+/); // semver format
    expect(status).toHaveProperty("status", "ok");
    expect(status).toHaveProperty("timestamp");
    expect(status).toHaveProperty("node");
  });

  it("returns valid ISO timestamp", () => {
    const status = getStatus();
    const date = new Date(status.timestamp);

    expect(date.toISOString()).toBe(status.timestamp);
  });

  it("returns current Node.js version", () => {
    const status = getStatus();

    expect(status.node).toBe(process.version);
  });
});
