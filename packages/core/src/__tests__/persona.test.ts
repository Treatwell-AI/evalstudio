import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createProjectModules, type PersonaModule } from "../index.js";
import { createFilesystemStorage } from "../filesystem-storage.js";
import type { StorageProvider } from "../storage-provider.js";

const projectId = "test-project-id";
let tempDir: string;
let storage: StorageProvider;
let mod: PersonaModule;

describe("persona", () => {
  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "evalstudio-test-"));
    mkdirSync(join(tempDir, "projects", projectId, "data"), { recursive: true });
    storage = createFilesystemStorage(tempDir);
    mod = createProjectModules(storage, projectId).personas;
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe("create", () => {
    it("creates a persona with required fields", async () => {
      const persona = await mod.create({ name: "Test Persona" });

      expect(persona.id).toBeDefined();
      expect(persona.name).toBe("Test Persona");
      expect(persona.description).toBeUndefined();
      expect(persona.systemPrompt).toBeUndefined();
      expect(persona.createdAt).toBeDefined();
      expect(persona.updatedAt).toBeDefined();
    });

    it("creates a persona with all fields", async () => {
      const persona = await mod.create({
        name: "Frustrated User",
        description: "A user who is impatient",
        systemPrompt: "You are a frustrated user...",
      });

      expect(persona.name).toBe("Frustrated User");
      expect(persona.description).toBe("A user who is impatient");
      expect(persona.systemPrompt).toBe("You are a frustrated user...");
    });

    it("throws error for duplicate name", async () => {
      await mod.create({ name: "Test Persona" });

      await expect(mod.create({ name: "Test Persona" })).rejects.toThrow(
        'Persona with name "Test Persona" already exists'
      );
    });
  });

  describe("get", () => {
    it("returns persona by id", async () => {
      const created = await mod.create({ name: "Test Persona" });
      const found = await mod.get(created.id);

      expect(found).toEqual(created);
    });

    it("returns undefined for non-existent id", async () => {
      const found = await mod.get("non-existent");

      expect(found).toBeUndefined();
    });
  });

  describe("getByName", () => {
    it("returns persona by name", async () => {
      const created = await mod.create({ name: "Test Persona" });
      const found = await mod.getByName("Test Persona");

      expect(found).toEqual(created);
    });

    it("returns undefined for non-existent name", async () => {
      const found = await mod.getByName("non-existent");

      expect(found).toBeUndefined();
    });
  });

  describe("list", () => {
    it("returns empty array when no personas", async () => {
      const personas = await mod.list();

      expect(personas).toEqual([]);
    });

    it("returns all personas", async () => {
      const persona1 = await mod.create({ name: "Persona 1" });
      const persona2 = await mod.create({ name: "Persona 2" });

      const personas = await mod.list();

      expect(personas).toHaveLength(2);
      expect(personas).toContainEqual(persona1);
      expect(personas).toContainEqual(persona2);
    });
  });

  describe("update", () => {
    it("updates persona name", async () => {
      const created = await mod.create({ name: "Old Name" });
      // Small delay to ensure timestamp changes
      await new Promise((resolve) => setTimeout(resolve, 10));
      const updated = await mod.update(created.id, { name: "New Name" });

      expect(updated?.name).toBe("New Name");
      expect(new Date(updated!.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(created.updatedAt).getTime()
      );
    });

    it("updates persona description", async () => {
      const created = await mod.create({ name: "Test" });
      const updated = await mod.update(created.id, {
        description: "New description",
      });

      expect(updated?.description).toBe("New description");
    });

    it("updates persona systemPrompt", async () => {
      const created = await mod.create({ name: "Test" });
      const updated = await mod.update(created.id, {
        systemPrompt: "New prompt",
      });

      expect(updated?.systemPrompt).toBe("New prompt");
    });

    it("returns undefined for non-existent id", async () => {
      const updated = await mod.update("non-existent", { name: "new-name" });

      expect(updated).toBeUndefined();
    });

    it("throws error for duplicate name", async () => {
      await mod.create({ name: "Persona 1" });
      const persona2 = await mod.create({ name: "Persona 2" });

      await expect(mod.update(persona2.id, { name: "Persona 1" })).rejects.toThrow(
        'Persona with name "Persona 1" already exists'
      );
    });
  });

  describe("delete", () => {
    it("deletes existing persona", async () => {
      const created = await mod.create({ name: "Test" });
      const deleted = await mod.delete(created.id);

      expect(deleted).toBe(true);
      expect(await mod.get(created.id)).toBeUndefined();
    });

    it("returns false for non-existent id", async () => {
      const deleted = await mod.delete("non-existent");

      expect(deleted).toBe(false);
    });
  });
});
