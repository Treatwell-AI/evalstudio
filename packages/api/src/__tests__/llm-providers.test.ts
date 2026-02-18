import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resetStorageDir, setConfigDir, setStorageDir } from "@evalstudio/core";
import { createServer } from "../index.js";

let testDir: string;

describe("llm-providers routes", () => {
  beforeAll(() => {
    testDir = mkdtempSync(join(tmpdir(), "evalstudio-test-"));
    const storageDir = join(testDir, "data");
    mkdirSync(storageDir, { recursive: true });
    writeFileSync(
      join(testDir, "evalstudio.config.json"),
      JSON.stringify({
        version: 2,
        name: "test-project",
        llmProvider: { provider: "openai", apiKey: "sk-test-key" },
      })
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

  describe("GET /llm-providers/models", () => {
    it("returns available models for all providers", async () => {
      const server = await createServer();

      const response = await server.inject({
        method: "GET",
        url: "/api/llm-providers/models",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.openai).toBeDefined();
      expect(body.anthropic).toBeDefined();
      expect(body.openai).toContain("gpt-4o");
      expect(body.anthropic).toContain("claude-sonnet-4-20250514");

      await server.close();
    });
  });

  describe("GET /llm-providers/:providerType/models", () => {
    it("returns 400 for invalid provider type", async () => {
      const server = await createServer();

      const response = await server.inject({
        method: "GET",
        url: "/api/llm-providers/invalid/models",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("Invalid provider type");

      await server.close();
    });
  });
});
