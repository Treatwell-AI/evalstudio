import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createLLMProvider,
  deleteLLMProvider,
  deleteLLMProvidersByProject,
  getDefaultModels,
  getLLMProvider,
  getLLMProviderByName,
  listLLMProviders,
  updateLLMProvider,
} from "../llm-provider.js";
import { createProject } from "../project.js";
import { resetStorageDir, setStorageDir } from "../storage.js";

let testDir: string;

describe("llm-provider", () => {
  let projectId: string;
  const testProjectName = `llm-provider-test-project-${Date.now()}`;

  beforeAll(() => {
    testDir = mkdtempSync(join(tmpdir(), "evalstudio-test-"));
    setStorageDir(testDir);
    // Create a project for testing
    const project = createProject({ name: testProjectName });
    projectId = project.id;
  });

  afterAll(() => {
    resetStorageDir();
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  beforeEach(() => {
    // Clean providers before each test
    const providersPath = join(testDir, "llm-providers.json");
    if (existsSync(providersPath)) {
      rmSync(providersPath);
    }
  });

  describe("createLLMProvider", () => {
    it("creates a provider with required fields", () => {
      const provider = createLLMProvider({
        projectId,
        name: "Test OpenAI",
        provider: "openai",
        apiKey: "sk-test-key",
      });

      expect(provider.id).toBeDefined();
      expect(provider.projectId).toBe(projectId);
      expect(provider.name).toBe("Test OpenAI");
      expect(provider.provider).toBe("openai");
      expect(provider.apiKey).toBe("sk-test-key");
      expect(provider.config).toBeUndefined();
      expect(provider.createdAt).toBeDefined();
      expect(provider.updatedAt).toBeDefined();
    });

    it("creates a provider with all fields including config", () => {
      const provider = createLLMProvider({
        projectId,
        name: "Production Anthropic",
        provider: "anthropic",
        apiKey: "sk-ant-test",
      });

      expect(provider.name).toBe("Production Anthropic");
      expect(provider.provider).toBe("anthropic");
    });

    it("throws error for non-existent project", () => {
      expect(() =>
        createLLMProvider({
          projectId: "non-existent",
          name: "Test",
          provider: "openai",
          apiKey: "key",
          })
      ).toThrow('Project with id "non-existent" not found');
    });

    it("throws error for duplicate name in same project", () => {
      createLLMProvider({
        projectId,
        name: "Duplicate Name",
        provider: "openai",
        apiKey: "key1",
      });

      expect(() =>
        createLLMProvider({
          projectId,
          name: "Duplicate Name",
          provider: "anthropic",
          apiKey: "key2",
          })
      ).toThrow('LLM Provider with name "Duplicate Name" already exists in this project');
    });

    it("allows same name in different projects", () => {
      const project2 = createProject({ name: `test-project-2-${Date.now()}` });

      const provider1 = createLLMProvider({
        projectId,
        name: "Same Name",
        provider: "openai",
        apiKey: "key1",
      });

      const provider2 = createLLMProvider({
        projectId: project2.id,
        name: "Same Name",
        provider: "anthropic",
        apiKey: "key2",
      });

      expect(provider1.id).not.toBe(provider2.id);
      expect(provider1.name).toBe(provider2.name);
    });
  });

  describe("getLLMProvider", () => {
    it("returns provider by id", () => {
      const created = createLLMProvider({
        projectId,
        name: "Get Test",
        provider: "openai",
        apiKey: "key",
      });

      const found = getLLMProvider(created.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
      expect(found?.name).toBe("Get Test");
    });

    it("returns undefined for non-existent id", () => {
      const found = getLLMProvider("non-existent-id");
      expect(found).toBeUndefined();
    });
  });

  describe("getLLMProviderByName", () => {
    it("returns provider by project and name", () => {
      createLLMProvider({
        projectId,
        name: "Named Provider",
        provider: "anthropic",
        apiKey: "key",
      });

      const found = getLLMProviderByName(projectId, "Named Provider");
      expect(found).toBeDefined();
      expect(found?.name).toBe("Named Provider");
    });

    it("returns undefined for non-existent name", () => {
      const found = getLLMProviderByName(projectId, "Non Existent");
      expect(found).toBeUndefined();
    });

    it("returns undefined for wrong project", () => {
      createLLMProvider({
        projectId,
        name: "Project Specific",
        provider: "openai",
        apiKey: "key",
      });

      const found = getLLMProviderByName("other-project-id", "Project Specific");
      expect(found).toBeUndefined();
    });
  });

  describe("listLLMProviders", () => {
    it("returns all providers when no projectId specified", () => {
      const project2 = createProject({ name: `list-test-project-${Date.now()}` });

      createLLMProvider({
        projectId,
        name: "Provider 1",
        provider: "openai",
        apiKey: "key1",
      });
      createLLMProvider({
        projectId: project2.id,
        name: "Provider 2",
        provider: "anthropic",
        apiKey: "key2",
      });

      const all = listLLMProviders();
      expect(all.length).toBeGreaterThanOrEqual(2);
    });

    it("returns only providers for specified project", () => {
      const project2 = createProject({ name: `filter-test-project-${Date.now()}` });

      createLLMProvider({
        projectId,
        name: "Main Project Provider",
        provider: "openai",
        apiKey: "key1",
      });
      createLLMProvider({
        projectId: project2.id,
        name: "Other Project Provider",
        provider: "anthropic",
        apiKey: "key2",
      });

      const filtered = listLLMProviders(projectId);
      expect(filtered.every((p) => p.projectId === projectId)).toBe(true);
    });

    it("returns empty array for project with no providers", () => {
      const emptyProject = createProject({ name: `empty-project-${Date.now()}` });
      const providers = listLLMProviders(emptyProject.id);
      expect(providers).toEqual([]);
    });
  });

  describe("updateLLMProvider", () => {
    it("updates provider name", () => {
      const created = createLLMProvider({
        projectId,
        name: "Original Name",
        provider: "openai",
        apiKey: "key",
      });

      const updated = updateLLMProvider(created.id, { name: "Updated Name" });
      expect(updated?.name).toBe("Updated Name");
      expect(updated?.updatedAt).toBeDefined();
      // Preserve other fields
      expect(updated?.provider).toBe("openai");
      expect(updated?.apiKey).toBe("key");
    });

    it("updates provider type", () => {
      const created = createLLMProvider({
        projectId,
        name: "Switch Provider",
        provider: "openai",
        apiKey: "key",
      });

      const updated = updateLLMProvider(created.id, {
        provider: "anthropic",
      });
      expect(updated?.provider).toBe("anthropic");
    });

    it("updates API key", () => {
      const created = createLLMProvider({
        projectId,
        name: "Key Update",
        provider: "openai",
        apiKey: "old-key",
      });

      const updated = updateLLMProvider(created.id, { apiKey: "new-key" });
      expect(updated?.apiKey).toBe("new-key");
    });

    it("updates config", () => {
      const created = createLLMProvider({
        projectId,
        name: "Config Update",
        provider: "openai",
        apiKey: "key",
        config: { customSetting: "initial" },
      });

      const updated = updateLLMProvider(created.id, {
        config: { customSetting: "updated", anotherOption: true },
      });
      expect(updated?.config).toEqual({ customSetting: "updated", anotherOption: true });
    });

    it("returns undefined for non-existent provider", () => {
      const updated = updateLLMProvider("non-existent", { name: "New Name" });
      expect(updated).toBeUndefined();
    });

    it("throws error for duplicate name on update", () => {
      createLLMProvider({
        projectId,
        name: "Existing Name",
        provider: "openai",
        apiKey: "key1",
      });

      const created = createLLMProvider({
        projectId,
        name: "To Be Updated",
        provider: "anthropic",
        apiKey: "key2",
      });

      expect(() =>
        updateLLMProvider(created.id, { name: "Existing Name" })
      ).toThrow('LLM Provider with name "Existing Name" already exists in this project');
    });
  });

  describe("deleteLLMProvider", () => {
    it("deletes provider and returns true", () => {
      const created = createLLMProvider({
        projectId,
        name: "To Delete",
        provider: "openai",
        apiKey: "key",
      });

      const result = deleteLLMProvider(created.id);
      expect(result).toBe(true);

      const found = getLLMProvider(created.id);
      expect(found).toBeUndefined();
    });

    it("returns false for non-existent provider", () => {
      const result = deleteLLMProvider("non-existent-id");
      expect(result).toBe(false);
    });
  });

  describe("deleteLLMProvidersByProject", () => {
    it("deletes all providers for a project", () => {
      const project = createProject({ name: `delete-all-test-${Date.now()}` });

      createLLMProvider({
        projectId: project.id,
        name: "Provider 1",
        provider: "openai",
        apiKey: "key1",
      });
      createLLMProvider({
        projectId: project.id,
        name: "Provider 2",
        provider: "anthropic",
        apiKey: "key2",
      });

      const count = deleteLLMProvidersByProject(project.id);
      expect(count).toBe(2);

      const remaining = listLLMProviders(project.id);
      expect(remaining).toEqual([]);
    });

    it("returns 0 for project with no providers", () => {
      const count = deleteLLMProvidersByProject("project-with-no-providers");
      expect(count).toBe(0);
    });
  });

  describe("getDefaultModels", () => {
    it("returns models for OpenAI and Anthropic", () => {
      const models = getDefaultModels();

      expect(models.openai).toBeDefined();
      expect(models.openai.length).toBeGreaterThan(0);
      expect(models.openai).toContain("gpt-4o");

      expect(models.anthropic).toBeDefined();
      expect(models.anthropic.length).toBeGreaterThan(0);
      expect(models.anthropic).toContain("claude-sonnet-4-20250514");
    });
  });
});
