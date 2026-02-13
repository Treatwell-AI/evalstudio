import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createLLMProvider,
  deleteLLMProvider,
  getDefaultModels,
  getLLMProvider,
  getLLMProviderByName,
  listLLMProviders,
  updateLLMProvider,
} from "../llm-provider.js";
import { resetStorageDir, setStorageDir } from "../storage.js";

let testDir: string;

describe("llm-provider", () => {
  beforeAll(() => {
    testDir = mkdtempSync(join(tmpdir(), "evalstudio-test-"));
    setStorageDir(testDir);
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
        name: "Test OpenAI",
        provider: "openai",
        apiKey: "sk-test-key",
      });

      expect(provider.id).toBeDefined();
      expect(provider.name).toBe("Test OpenAI");
      expect(provider.provider).toBe("openai");
      expect(provider.apiKey).toBe("sk-test-key");
      expect(provider.config).toBeUndefined();
      expect(provider.createdAt).toBeDefined();
      expect(provider.updatedAt).toBeDefined();
    });

    it("creates a provider with all fields including config", () => {
      const provider = createLLMProvider({
        name: "Production Anthropic",
        provider: "anthropic",
        apiKey: "sk-ant-test",
      });

      expect(provider.name).toBe("Production Anthropic");
      expect(provider.provider).toBe("anthropic");
    });

    it("throws error for duplicate name", () => {
      createLLMProvider({
        name: "Duplicate Name",
        provider: "openai",
        apiKey: "key1",
      });

      expect(() =>
        createLLMProvider({
          name: "Duplicate Name",
          provider: "anthropic",
          apiKey: "key2",
        })
      ).toThrow('LLM Provider with name "Duplicate Name" already exists');
    });
  });

  describe("getLLMProvider", () => {
    it("returns provider by id", () => {
      const created = createLLMProvider({
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
    it("returns provider by name", () => {
      createLLMProvider({
        name: "Named Provider",
        provider: "anthropic",
        apiKey: "key",
      });

      const found = getLLMProviderByName("Named Provider");
      expect(found).toBeDefined();
      expect(found?.name).toBe("Named Provider");
    });

    it("returns undefined for non-existent name", () => {
      const found = getLLMProviderByName("Non Existent");
      expect(found).toBeUndefined();
    });
  });

  describe("listLLMProviders", () => {
    it("returns all providers", () => {
      createLLMProvider({
        name: "Provider 1",
        provider: "openai",
        apiKey: "key1",
      });
      createLLMProvider({
        name: "Provider 2",
        provider: "anthropic",
        apiKey: "key2",
      });

      const all = listLLMProviders();
      expect(all).toHaveLength(2);
    });

    it("returns empty array when no providers", () => {
      const providers = listLLMProviders();
      expect(providers).toEqual([]);
    });
  });

  describe("updateLLMProvider", () => {
    it("updates provider name", () => {
      const created = createLLMProvider({
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
        name: "Key Update",
        provider: "openai",
        apiKey: "old-key",
      });

      const updated = updateLLMProvider(created.id, { apiKey: "new-key" });
      expect(updated?.apiKey).toBe("new-key");
    });

    it("updates config", () => {
      const created = createLLMProvider({
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
        name: "Existing Name",
        provider: "openai",
        apiKey: "key1",
      });

      const created = createLLMProvider({
        name: "To Be Updated",
        provider: "anthropic",
        apiKey: "key2",
      });

      expect(() =>
        updateLLMProvider(created.id, { name: "Existing Name" })
      ).toThrow('LLM Provider with name "Existing Name" already exists');
    });
  });

  describe("deleteLLMProvider", () => {
    it("deletes provider and returns true", () => {
      const created = createLLMProvider({
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
