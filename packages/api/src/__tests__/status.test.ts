import { existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setStorageDir, setConfigDir, resetStorageDir } from "@evalstudio/core";
import { createServer } from "../index.js";

let testDir: string;

describe("GET /status", () => {
  beforeAll(() => {
    testDir = mkdtempSync(join(tmpdir(), "evalstudio-api-test-"));
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

  it("returns status object", async () => {
    const server = await createServer();

    const response = await server.inject({
      method: "GET",
      url: "/api/status",
    });

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body);
    expect(body).toHaveProperty("name", "evalstudio");
    expect(body).toHaveProperty("version");
    expect(body.version).toMatch(/^\d+\.\d+\.\d+/); // semver format
    expect(body).toHaveProperty("status", "ok");
    expect(body).toHaveProperty("timestamp");
    expect(body).toHaveProperty("node");

    await server.close();
  });
});
