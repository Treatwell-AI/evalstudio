import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { initWorkspace, updateWorkspaceConfig } from "@evalstudio/core";
import { createServer } from "../index.js";

let workspaceDir: string;

describe("llm-providers routes", () => {
  beforeAll(() => {
    workspaceDir = mkdtempSync(join(tmpdir(), "evalstudio-test-"));
    initWorkspace(workspaceDir, "test-workspace", "test-project");
    updateWorkspaceConfig(workspaceDir, {
      llmSettings: { provider: "openai", apiKey: "sk-test-key" },
    });
  });

  afterAll(() => {
    if (existsSync(workspaceDir)) {
      rmSync(workspaceDir, { recursive: true });
    }
  });

  describe("GET /llm-providers/models", () => {
    it("returns grouped models for all providers", async () => {
      const server = await createServer({ workspaceDir, runProcessor: false });

      const response = await server.inject({
        method: "GET",
        url: "/api/llm-providers/models",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.openai).toBeDefined();
      expect(body.anthropic).toBeDefined();
      expect(Array.isArray(body.openai)).toBe(true);
      expect(body.openai[0]).toHaveProperty("label");
      expect(body.openai[0]).toHaveProperty("models");

      const openaiModels = body.openai.flatMap((g: { models: string[] }) => g.models);
      expect(openaiModels).toContain("gpt-4o");

      const anthropicModels = body.anthropic.flatMap((g: { models: string[] }) => g.models);
      expect(anthropicModels).toContain("claude-sonnet-4-20250514");

      await server.close();
    });
  });

  describe("GET /llm-providers/:providerType/models", () => {
    it("returns 400 for invalid provider type", async () => {
      const server = await createServer({ workspaceDir, runProcessor: false });

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
