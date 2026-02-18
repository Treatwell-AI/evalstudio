import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  getDefaultModels,
  getLLMProviderFromConfig,
} from "../llm-provider.js";
import { resetStorageDir, setConfigDir, setStorageDir } from "../project-resolver.js";

let testDir: string;

describe("llm-provider", () => {
  beforeAll(() => {
    testDir = mkdtempSync(join(tmpdir(), "evalstudio-test-"));
    setStorageDir(testDir);
    setConfigDir(testDir);
  });

  afterAll(() => {
    resetStorageDir();
    rmSync(testDir, { recursive: true, force: true });
  });

  describe("getLLMProviderFromConfig", () => {
    it("returns provider from config", () => {
      writeFileSync(
        join(testDir, "evalstudio.config.json"),
        JSON.stringify({
          version: 2,
          name: "test-project",
          llmSettings: {
            provider: "openai",
            apiKey: "sk-test-key",
          },
        }, null, 2)
      );

      const provider = getLLMProviderFromConfig();

      expect(provider.provider).toBe("openai");
      expect(provider.apiKey).toBe("sk-test-key");
    });

    it("throws when no provider configured", () => {
      writeFileSync(
        join(testDir, "evalstudio.config.json"),
        JSON.stringify({ version: 2, name: "test-project" }, null, 2)
      );

      expect(() => getLLMProviderFromConfig()).toThrow(
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
