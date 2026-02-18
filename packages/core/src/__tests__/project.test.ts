import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  getProjectConfig,
  updateProjectConfig,
} from "../project.js";
import { resetStorageDir, setConfigDir, setStorageDir } from "../project-resolver.js";

let testDir: string;

describe("project config", () => {
  beforeAll(() => {
    testDir = mkdtempSync(join(tmpdir(), "evalstudio-test-"));
    setStorageDir(testDir);
    setConfigDir(testDir);
    writeFileSync(
      join(testDir, "evalstudio.config.json"),
      JSON.stringify({ version: 2, name: "test-project" }, null, 2)
    );
  });

  afterAll(() => {
    resetStorageDir();
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  beforeEach(() => {
    writeFileSync(
      join(testDir, "evalstudio.config.json"),
      JSON.stringify({ version: 2, name: "test-project" }, null, 2)
    );
  });

  describe("getProjectConfig", () => {
    it("returns project config", () => {
      const config = getProjectConfig();

      expect(config.version).toBe(2);
      expect(config.name).toBe("test-project");
    });

    it("returns config with llmProvider when set", () => {
      writeFileSync(
        join(testDir, "evalstudio.config.json"),
        JSON.stringify({
          version: 2,
          name: "test-project",
          llmProvider: { provider: "openai", apiKey: "sk-test" },
        }, null, 2)
      );

      const config = getProjectConfig();

      expect(config.llmProvider?.provider).toBe("openai");
      expect(config.llmProvider?.apiKey).toBe("sk-test");
    });

    it("returns config with llmSettings when set", () => {
      writeFileSync(
        join(testDir, "evalstudio.config.json"),
        JSON.stringify({
          version: 2,
          name: "test-project",
          llmSettings: {
            evaluation: { model: "gpt-4o" },
          },
        }, null, 2)
      );

      const config = getProjectConfig();

      expect(config.llmSettings?.evaluation?.model).toBe("gpt-4o");
    });
  });

  describe("updateProjectConfig", () => {
    it("updates project name", () => {
      const updated = updateProjectConfig({ name: "new-name" });

      expect(updated.name).toBe("new-name");
      expect(updated.version).toBe(2);
    });

    it("updates llmProvider", () => {
      const updated = updateProjectConfig({
        llmProvider: { provider: "openai", apiKey: "sk-test" },
      });

      expect(updated.llmProvider?.provider).toBe("openai");
      expect(updated.llmProvider?.apiKey).toBe("sk-test");
    });

    it("clears llmProvider when set to null", () => {
      writeFileSync(
        join(testDir, "evalstudio.config.json"),
        JSON.stringify({
          version: 2,
          name: "test-project",
          llmProvider: { provider: "openai", apiKey: "sk-test" },
        }, null, 2)
      );

      const updated = updateProjectConfig({ llmProvider: null });

      expect(updated.llmProvider).toBeUndefined();
    });

    it("updates llmSettings", () => {
      const updated = updateProjectConfig({
        llmSettings: {
          evaluation: { model: "gpt-4o" },
        },
      });

      expect(updated.llmSettings?.evaluation?.model).toBe("gpt-4o");
    });

    it("preserves existing fields when updating partially", () => {
      writeFileSync(
        join(testDir, "evalstudio.config.json"),
        JSON.stringify({
          version: 2,
          name: "original-name",
          llmProvider: { provider: "openai", apiKey: "sk-test" },
          llmSettings: {
            evaluation: { model: "gpt-4o" },
          },
        }, null, 2)
      );

      const updated = updateProjectConfig({ name: "updated-name" });

      expect(updated.name).toBe("updated-name");
      expect(updated.llmProvider?.provider).toBe("openai");
      expect(updated.llmSettings?.evaluation?.model).toBe("gpt-4o");
    });

    it("validates llmProvider requires provider type", () => {
      expect(() =>
        updateProjectConfig({
          llmProvider: { provider: "" as "openai", apiKey: "sk-test" },
        })
      ).toThrow("LLM provider type is required");
    });

    it("validates llmProvider requires apiKey", () => {
      expect(() =>
        updateProjectConfig({
          llmProvider: { provider: "openai", apiKey: "" },
        })
      ).toThrow("LLM provider API key is required");
    });
  });

  describe("maxConcurrency", () => {
    it("returns config with maxConcurrency when set", () => {
      writeFileSync(
        join(testDir, "evalstudio.config.json"),
        JSON.stringify({
          version: 2,
          name: "test-project",
          maxConcurrency: 5,
        }, null, 2)
      );

      const config = getProjectConfig();

      expect(config.maxConcurrency).toBe(5);
    });

    it("returns undefined maxConcurrency when not set", () => {
      const config = getProjectConfig();

      expect(config.maxConcurrency).toBeUndefined();
    });

    it("updates maxConcurrency", () => {
      const updated = updateProjectConfig({ maxConcurrency: 10 });

      expect(updated.maxConcurrency).toBe(10);
      expect(updated.name).toBe("test-project");
    });

    it("clears maxConcurrency when set to null", () => {
      writeFileSync(
        join(testDir, "evalstudio.config.json"),
        JSON.stringify({
          version: 2,
          name: "test-project",
          maxConcurrency: 5,
        }, null, 2)
      );

      const updated = updateProjectConfig({ maxConcurrency: null });

      expect(updated.maxConcurrency).toBeUndefined();
    });

    it("preserves maxConcurrency when not included in update", () => {
      writeFileSync(
        join(testDir, "evalstudio.config.json"),
        JSON.stringify({
          version: 2,
          name: "test-project",
          maxConcurrency: 7,
        }, null, 2)
      );

      const updated = updateProjectConfig({ name: "new-name" });

      expect(updated.name).toBe("new-name");
      expect(updated.maxConcurrency).toBe(7);
    });

    it("throws when maxConcurrency is less than 1", () => {
      expect(() => updateProjectConfig({ maxConcurrency: 0 })).toThrow(
        "maxConcurrency must be at least 1"
      );

      expect(() => updateProjectConfig({ maxConcurrency: -1 })).toThrow(
        "maxConcurrency must be at least 1"
      );
    });
  });
});
