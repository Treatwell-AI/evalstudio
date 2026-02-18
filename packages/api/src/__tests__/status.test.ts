import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { initWorkspace } from "@evalstudio/core";
import { createServer } from "../index.js";

let workspaceDir: string;

describe("GET /status", () => {
  beforeAll(() => {
    workspaceDir = mkdtempSync(join(tmpdir(), "evalstudio-api-test-"));
    initWorkspace(workspaceDir, "test-workspace", "test-project");
  });

  afterAll(() => {
    if (existsSync(workspaceDir)) {
      rmSync(workspaceDir, { recursive: true });
    }
  });

  it("returns status object", async () => {
    const server = await createServer({ workspaceDir, runProcessor: false });

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
