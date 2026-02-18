import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createPersonaModule } from "../persona.js";
import type { ProjectContext } from "../project-resolver.js";

let tempDir: string;
let ctx: ProjectContext;
let mod: ReturnType<typeof createPersonaModule>;

describe("persona", () => {
  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "evalstudio-test-"));
    const dataDir = join(tempDir, "data");
    mkdirSync(dataDir, { recursive: true });
    ctx = {
      id: "test-project-id",
      name: "Test Project",
      dataDir,
      configPath: join(tempDir, "project.config.json"),
      workspaceDir: tempDir,
    };
    mod = createPersonaModule(ctx);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe("create", () => {
    it("creates a persona with required fields", () => {
      const persona = mod.create({ name: "Test Persona" });

      expect(persona.id).toBeDefined();
      expect(persona.name).toBe("Test Persona");
      expect(persona.description).toBeUndefined();
      expect(persona.systemPrompt).toBeUndefined();
      expect(persona.createdAt).toBeDefined();
      expect(persona.updatedAt).toBeDefined();
    });

    it("creates a persona with all fields", () => {
      const persona = mod.create({
        name: "Frustrated User",
        description: "A user who is impatient",
        systemPrompt: "You are a frustrated user...",
      });

      expect(persona.name).toBe("Frustrated User");
      expect(persona.description).toBe("A user who is impatient");
      expect(persona.systemPrompt).toBe("You are a frustrated user...");
    });

    it("throws error for duplicate name", () => {
      mod.create({ name: "Test Persona" });

      expect(() => mod.create({ name: "Test Persona" })).toThrow(
        'Persona with name "Test Persona" already exists'
      );
    });
  });

  describe("get", () => {
    it("returns persona by id", () => {
      const created = mod.create({ name: "Test Persona" });
      const found = mod.get(created.id);

      expect(found).toEqual(created);
    });

    it("returns undefined for non-existent id", () => {
      const found = mod.get("non-existent");

      expect(found).toBeUndefined();
    });
  });

  describe("getByName", () => {
    it("returns persona by name", () => {
      const created = mod.create({ name: "Test Persona" });
      const found = mod.getByName("Test Persona");

      expect(found).toEqual(created);
    });

    it("returns undefined for non-existent name", () => {
      const found = mod.getByName("non-existent");

      expect(found).toBeUndefined();
    });
  });

  describe("list", () => {
    it("returns empty array when no personas", () => {
      const personas = mod.list();

      expect(personas).toEqual([]);
    });

    it("returns all personas", () => {
      const persona1 = mod.create({ name: "Persona 1" });
      const persona2 = mod.create({ name: "Persona 2" });

      const personas = mod.list();

      expect(personas).toHaveLength(2);
      expect(personas).toContainEqual(persona1);
      expect(personas).toContainEqual(persona2);
    });
  });

  describe("update", () => {
    it("updates persona name", async () => {
      const created = mod.create({ name: "Old Name" });
      // Small delay to ensure timestamp changes
      await new Promise((resolve) => setTimeout(resolve, 10));
      const updated = mod.update(created.id, { name: "New Name" });

      expect(updated?.name).toBe("New Name");
      expect(new Date(updated!.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(created.updatedAt).getTime()
      );
    });

    it("updates persona description", () => {
      const created = mod.create({ name: "Test" });
      const updated = mod.update(created.id, {
        description: "New description",
      });

      expect(updated?.description).toBe("New description");
    });

    it("updates persona systemPrompt", () => {
      const created = mod.create({ name: "Test" });
      const updated = mod.update(created.id, {
        systemPrompt: "New prompt",
      });

      expect(updated?.systemPrompt).toBe("New prompt");
    });

    it("returns undefined for non-existent id", () => {
      const updated = mod.update("non-existent", { name: "new-name" });

      expect(updated).toBeUndefined();
    });

    it("throws error for duplicate name", () => {
      mod.create({ name: "Persona 1" });
      const persona2 = mod.create({ name: "Persona 2" });

      expect(() => mod.update(persona2.id, { name: "Persona 1" })).toThrow(
        'Persona with name "Persona 1" already exists'
      );
    });
  });

  describe("delete", () => {
    it("deletes existing persona", () => {
      const created = mod.create({ name: "Test" });
      const deleted = mod.delete(created.id);

      expect(deleted).toBe(true);
      expect(mod.get(created.id)).toBeUndefined();
    });

    it("returns false for non-existent id", () => {
      const deleted = mod.delete("non-existent");

      expect(deleted).toBe(false);
    });
  });
});
