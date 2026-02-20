import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getDefaultModels,
  getLLMProviderFromProjectConfig,
} from "../llm-provider.js";
import { createFilesystemStorage } from "../filesystem-storage.js";
import type { StorageProvider } from "../storage-provider.js";

let tempDir: string;
let storage: StorageProvider;

function setupWorkspace(
  wsOverrides: Record<string, unknown> = {},
  projOverrides: Record<string, unknown> = {},
) {
  const projectId = "proj1";
  const projectDir = join(tempDir, "projects", projectId);
  const dataDir = join(projectDir, "data");
  mkdirSync(dataDir, { recursive: true });

  const projectEntry = { id: projectId, name: "Test Project", ...projOverrides };
  const wsConfig = {
    version: 3,
    name: "test-workspace",
    projects: [projectEntry],
    ...wsOverrides,
  };
  writeFileSync(
    join(tempDir, "evalstudio.config.json"),
    JSON.stringify(wsConfig, null, 2),
  );

  storage = createFilesystemStorage(tempDir);
}

describe("llm-provider", () => {
  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "evalstudio-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe("getLLMProviderFromProjectConfig", () => {
    it("returns provider from project config", async () => {
      setupWorkspace({}, {
        llmSettings: {
          provider: "openai",
          apiKey: "sk-test-key",
        },
      });

      const provider = await getLLMProviderFromProjectConfig(storage, tempDir, "proj1");

      expect(provider.provider).toBe("openai");
      expect(provider.apiKey).toBe("sk-test-key");
    });

    it("returns provider inherited from workspace config", async () => {
      setupWorkspace(
        { llmSettings: { provider: "anthropic", apiKey: "sk-ws-key" } },
        {},
      );

      const provider = await getLLMProviderFromProjectConfig(storage, tempDir, "proj1");

      expect(provider.provider).toBe("anthropic");
      expect(provider.apiKey).toBe("sk-ws-key");
    });

    it("throws when no provider configured", async () => {
      setupWorkspace({}, {});

      await expect(getLLMProviderFromProjectConfig(storage, tempDir, "proj1")).rejects.toThrow(
        "No LLM provider configured"
      );
    });
  });

  describe("getDefaultModels", () => {
    it("returns grouped models for OpenAI and Anthropic", () => {
      const models = getDefaultModels();

      expect(models.openai).toBeDefined();
      expect(models.openai.length).toBeGreaterThan(0);
      expect(models.openai[0]).toHaveProperty("label");
      expect(models.openai[0]).toHaveProperty("models");

      const openaiModels = models.openai.flatMap((g) => g.models);
      expect(openaiModels).toContain("gpt-4o");

      expect(models.anthropic).toBeDefined();
      expect(models.anthropic.length).toBeGreaterThan(0);

      const anthropicModels = models.anthropic.flatMap((g) => g.models);
      expect(anthropicModels).toContain("claude-sonnet-4-20250514");
    });
  });
});
