import { existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getStatus } from "../status.js";
import { setStorageDir, setConfigDir, resetStorageDir } from "../storage.js";

let testDir: string;

describe("getStatus", () => {
  beforeAll(() => {
    testDir = mkdtempSync(join(tmpdir(), "evalstudio-status-test-"));
    const storageDir = join(testDir, "data");
    mkdirSync(storageDir, { recursive: true });
    writeFileSync(
      join(testDir, "evalstudio.config.json"),
      JSON.stringify({ version: 2, name: "test-project" })
    );
    setStorageDir(storageDir);
    setConfigDir(testDir);
  });

  afterAll(() => {
    resetStorageDir();
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

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
