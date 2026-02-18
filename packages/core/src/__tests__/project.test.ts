import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getProjectConfig,
  readWorkspaceConfig,
  updateProjectConfig,
  updateWorkspaceConfig,
  redactApiKey,
} from "../project.js";
import type { ProjectContext } from "../project-resolver.js";

let tempDir: string;
let ctx: ProjectContext;

/**
 * Helper to set up the workspace structure:
 *   tempDir/
 *     evalstudio.config.json    (workspace config)
 *     projects/
 *       proj1/
 *         project.config.json   (per-project config)
 *         data/
 */
function setupWorkspace(
  wsOverrides: Record<string, unknown> = {},
  projOverrides: Record<string, unknown> = {},
) {
  const projectId = "proj1";
  const projectDir = join(tempDir, "projects", projectId);
  const dataDir = join(projectDir, "data");
  mkdirSync(dataDir, { recursive: true });

  const wsConfig = {
    version: 3,
    name: "test-workspace",
    projects: [{ id: projectId, name: "Test Project" }],
    ...wsOverrides,
  };
  writeFileSync(
    join(tempDir, "evalstudio.config.json"),
    JSON.stringify(wsConfig, null, 2),
  );

  const projConfig = {
    name: "Test Project",
    ...projOverrides,
  };
  writeFileSync(
    join(projectDir, "project.config.json"),
    JSON.stringify(projConfig, null, 2),
  );

  ctx = {
    id: projectId,
    name: "Test Project",
    dataDir,
    configPath: join(projectDir, "project.config.json"),
    workspaceDir: tempDir,
  };
}

describe("project config", () => {
  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "evalstudio-test-"));
    setupWorkspace();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe("getProjectConfig", () => {
    it("returns project config", () => {
      const config = getProjectConfig(ctx);

      expect(config.version).toBe(3);
      expect(config.name).toBe("Test Project");
    });

    it("returns config with llmSettings from project override", () => {
      setupWorkspace({}, {
        llmSettings: { provider: "openai", apiKey: "sk-test" },
      });

      const config = getProjectConfig(ctx);

      expect(config.llmSettings?.provider).toBe("openai");
      expect(config.llmSettings?.apiKey).toBe("sk-test");
    });

    it("inherits llmSettings from workspace when project does not override", () => {
      setupWorkspace(
        { llmSettings: { provider: "openai", apiKey: "sk-workspace" } },
        {},
      );

      const config = getProjectConfig(ctx);

      expect(config.llmSettings?.provider).toBe("openai");
      expect(config.llmSettings?.apiKey).toBe("sk-workspace");
    });

    it("returns config with llmSettings models when set", () => {
      setupWorkspace({}, {
        llmSettings: {
          provider: "openai",
          apiKey: "sk-test",
          models: { evaluation: "gpt-4o" },
        },
      });

      const config = getProjectConfig(ctx);

      expect(config.llmSettings?.models?.evaluation).toBe("gpt-4o");
    });
  });

  describe("updateProjectConfig", () => {
    it("updates project name", () => {
      const updated = updateProjectConfig(ctx, { name: "new-name" });

      expect(updated.name).toBe("new-name");
      expect(updated.version).toBe(3);
    });

    it("updates llmSettings", () => {
      const updated = updateProjectConfig(ctx, {
        llmSettings: { provider: "openai", apiKey: "sk-test" },
      });

      expect(updated.llmSettings?.provider).toBe("openai");
      expect(updated.llmSettings?.apiKey).toBe("sk-test");
    });

    it("clears llmSettings when set to null (inherits from workspace)", () => {
      setupWorkspace(
        { llmSettings: { provider: "anthropic", apiKey: "sk-ws" } },
        { llmSettings: { provider: "openai", apiKey: "sk-proj" } },
      );

      const updated = updateProjectConfig(ctx, { llmSettings: null });

      // After clearing, should inherit from workspace
      expect(updated.llmSettings?.provider).toBe("anthropic");
      expect(updated.llmSettings?.apiKey).toBe("sk-ws");
    });

    it("updates llmSettings with models", () => {
      const updated = updateProjectConfig(ctx, {
        llmSettings: {
          provider: "openai",
          apiKey: "sk-test",
          models: { evaluation: "gpt-4o" },
        },
      });

      expect(updated.llmSettings?.models?.evaluation).toBe("gpt-4o");
    });

    it("preserves existing fields when updating partially", () => {
      setupWorkspace({}, {
        llmSettings: {
          provider: "openai",
          apiKey: "sk-test",
          models: { evaluation: "gpt-4o" },
        },
      });

      const updated = updateProjectConfig(ctx, { name: "updated-name" });

      expect(updated.name).toBe("updated-name");
      expect(updated.llmSettings?.provider).toBe("openai");
      expect(updated.llmSettings?.models?.evaluation).toBe("gpt-4o");
    });

    it("validates llmSettings requires provider type", () => {
      expect(() =>
        updateProjectConfig(ctx, {
          llmSettings: { provider: "" as "openai", apiKey: "sk-test" },
        })
      ).toThrow("LLM provider type is required");
    });

    it("validates llmSettings requires apiKey", () => {
      expect(() =>
        updateProjectConfig(ctx, {
          llmSettings: { provider: "openai", apiKey: "" },
        })
      ).toThrow("LLM provider API key is required");
    });

    it("keeps existing project apiKey when apiKey is omitted from update", () => {
      setupWorkspace({}, {
        llmSettings: { provider: "openai", apiKey: "sk-existing-key-1234" },
      });

      const updated = updateProjectConfig(ctx, {
        llmSettings: {
          provider: "anthropic",
          apiKey: "",
          models: { evaluation: "claude-sonnet-4-5-20250929" },
        },
      });

      expect(updated.llmSettings?.provider).toBe("anthropic");
      expect(updated.llmSettings?.apiKey).toBe("sk-existing-key-1234");
      expect(updated.llmSettings?.models?.evaluation).toBe("claude-sonnet-4-5-20250929");
    });

    it("keeps workspace apiKey when project has no key and apiKey is omitted", () => {
      setupWorkspace(
        { llmSettings: { provider: "openai", apiKey: "sk-workspace-key" } },
        {},
      );

      const updated = updateProjectConfig(ctx, {
        llmSettings: {
          provider: "openai",
          apiKey: "",
          models: { evaluation: "gpt-4o" },
        },
      });

      expect(updated.llmSettings?.apiKey).toBe("sk-workspace-key");
    });

    it("throws when apiKey is omitted and no existing key exists", () => {
      expect(() =>
        updateProjectConfig(ctx, {
          llmSettings: { provider: "openai", apiKey: "" },
        })
      ).toThrow("LLM provider API key is required");
    });
  });

  describe("maxConcurrency", () => {
    it("returns config with maxConcurrency from project override", () => {
      setupWorkspace({}, { maxConcurrency: 5 });

      const config = getProjectConfig(ctx);

      expect(config.maxConcurrency).toBe(5);
    });

    it("inherits maxConcurrency from workspace when project does not override", () => {
      setupWorkspace({ maxConcurrency: 8 }, {});

      const config = getProjectConfig(ctx);

      expect(config.maxConcurrency).toBe(8);
    });

    it("returns undefined maxConcurrency when not set", () => {
      const config = getProjectConfig(ctx);

      expect(config.maxConcurrency).toBeUndefined();
    });

    it("updates maxConcurrency", () => {
      const updated = updateProjectConfig(ctx, { maxConcurrency: 10 });

      expect(updated.maxConcurrency).toBe(10);
      expect(updated.name).toBe("Test Project");
    });

    it("clears maxConcurrency when set to null (inherits from workspace)", () => {
      setupWorkspace({ maxConcurrency: 7 }, { maxConcurrency: 5 });

      const updated = updateProjectConfig(ctx, { maxConcurrency: null });

      // After clearing, should inherit from workspace
      expect(updated.maxConcurrency).toBe(7);
    });

    it("preserves maxConcurrency when not included in update", () => {
      setupWorkspace({}, { maxConcurrency: 7 });

      const updated = updateProjectConfig(ctx, { name: "new-name" });

      expect(updated.name).toBe("new-name");
      expect(updated.maxConcurrency).toBe(7);
    });

    it("throws when maxConcurrency is less than 1", () => {
      expect(() => updateProjectConfig(ctx, { maxConcurrency: 0 })).toThrow(
        "maxConcurrency must be at least 1"
      );

      expect(() => updateProjectConfig(ctx, { maxConcurrency: -1 })).toThrow(
        "maxConcurrency must be at least 1"
      );
    });
  });

  describe("readWorkspaceConfig", () => {
    it("reads workspace config", () => {
      const config = readWorkspaceConfig(tempDir);

      expect(config.version).toBe(3);
      expect(config.name).toBe("test-workspace");
      expect(config.projects).toHaveLength(1);
      expect(config.projects[0].id).toBe("proj1");
    });
  });

  describe("updateWorkspaceConfig", () => {
    it("updates workspace name", () => {
      const updated = updateWorkspaceConfig(tempDir, { name: "new-ws-name" });

      expect(updated.name).toBe("new-ws-name");
    });

    it("updates workspace llmSettings", () => {
      const updated = updateWorkspaceConfig(tempDir, {
        llmSettings: { provider: "openai", apiKey: "sk-ws-key" },
      });

      expect(updated.llmSettings?.provider).toBe("openai");
      expect(updated.llmSettings?.apiKey).toBe("sk-ws-key");
    });

    it("validates workspace llmSettings requires provider", () => {
      expect(() =>
        updateWorkspaceConfig(tempDir, {
          llmSettings: { provider: "" as "openai", apiKey: "sk-test" },
        })
      ).toThrow("LLM provider type is required");
    });

    it("validates workspace llmSettings requires apiKey", () => {
      expect(() =>
        updateWorkspaceConfig(tempDir, {
          llmSettings: { provider: "openai", apiKey: "" },
        })
      ).toThrow("LLM provider API key is required");
    });

    it("keeps existing workspace apiKey when apiKey is omitted from update", () => {
      setupWorkspace({
        llmSettings: { provider: "openai", apiKey: "sk-ws-existing-key" },
      });

      const updated = updateWorkspaceConfig(tempDir, {
        llmSettings: {
          provider: "anthropic",
          apiKey: "",
          models: { evaluation: "claude-sonnet-4-5-20250929" },
        },
      });

      expect(updated.llmSettings?.provider).toBe("anthropic");
      expect(updated.llmSettings?.apiKey).toBe("sk-ws-existing-key");
    });

    it("throws when apiKey is omitted and no existing workspace key exists", () => {
      expect(() =>
        updateWorkspaceConfig(tempDir, {
          llmSettings: { provider: "openai", apiKey: "" },
        })
      ).toThrow("LLM provider API key is required");
    });
  });

  describe("redactApiKey", () => {
    it("masks long keys showing first 4 and last 4 characters", () => {
      expect(redactApiKey("sk-1234567890abcdef")).toBe("sk-1...cdef");
    });

    it("returns **** for short keys (8 chars or less)", () => {
      expect(redactApiKey("sk-12")).toBe("****");
      expect(redactApiKey("12345678")).toBe("****");
    });

    it("masks keys with exactly 9 characters", () => {
      expect(redactApiKey("123456789")).toBe("1234...6789");
    });
  });
});
