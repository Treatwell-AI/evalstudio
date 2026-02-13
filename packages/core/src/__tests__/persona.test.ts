import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createPersona,
  deletePersona,
  getPersona,
  getPersonaByName,
  listPersonas,
  updatePersona,
} from "../persona.js";
import { resetStorageDir, setStorageDir } from "../storage.js";

let testDir: string;

describe("persona", () => {
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
    // Clean personas before each test
    const personasPath = join(testDir, "personas.json");
    if (existsSync(personasPath)) {
      rmSync(personasPath);
    }
  });

  describe("createPersona", () => {
    it("creates a persona with required fields", () => {
      const persona = createPersona({ name: "Test Persona" });

      expect(persona.id).toBeDefined();
      expect(persona.name).toBe("Test Persona");
      expect(persona.description).toBeUndefined();
      expect(persona.systemPrompt).toBeUndefined();
      expect(persona.createdAt).toBeDefined();
      expect(persona.updatedAt).toBeDefined();
    });

    it("creates a persona with all fields", () => {
      const persona = createPersona({
        name: "Frustrated User",
        description: "A user who is impatient",
        systemPrompt: "You are a frustrated user...",
      });

      expect(persona.name).toBe("Frustrated User");
      expect(persona.description).toBe("A user who is impatient");
      expect(persona.systemPrompt).toBe("You are a frustrated user...");
    });

    it("throws error for duplicate name", () => {
      createPersona({ name: "Test Persona" });

      expect(() => createPersona({ name: "Test Persona" })).toThrow(
        'Persona with name "Test Persona" already exists'
      );
    });
  });

  describe("getPersona", () => {
    it("returns persona by id", () => {
      const created = createPersona({ name: "Test Persona" });
      const found = getPersona(created.id);

      expect(found).toEqual(created);
    });

    it("returns undefined for non-existent id", () => {
      const found = getPersona("non-existent");

      expect(found).toBeUndefined();
    });
  });

  describe("getPersonaByName", () => {
    it("returns persona by name", () => {
      const created = createPersona({ name: "Test Persona" });
      const found = getPersonaByName("Test Persona");

      expect(found).toEqual(created);
    });

    it("returns undefined for non-existent name", () => {
      const found = getPersonaByName("non-existent");

      expect(found).toBeUndefined();
    });
  });

  describe("listPersonas", () => {
    it("returns empty array when no personas", () => {
      const personas = listPersonas();

      expect(personas).toEqual([]);
    });

    it("returns all personas", () => {
      const persona1 = createPersona({ name: "Persona 1" });
      const persona2 = createPersona({ name: "Persona 2" });

      const personas = listPersonas();

      expect(personas).toHaveLength(2);
      expect(personas).toContainEqual(persona1);
      expect(personas).toContainEqual(persona2);
    });
  });

  describe("updatePersona", () => {
    it("updates persona name", async () => {
      const created = createPersona({ name: "Old Name" });
      // Small delay to ensure timestamp changes
      await new Promise((resolve) => setTimeout(resolve, 10));
      const updated = updatePersona(created.id, { name: "New Name" });

      expect(updated?.name).toBe("New Name");
      expect(new Date(updated!.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(created.updatedAt).getTime()
      );
    });

    it("updates persona description", () => {
      const created = createPersona({ name: "Test" });
      const updated = updatePersona(created.id, {
        description: "New description",
      });

      expect(updated?.description).toBe("New description");
    });

    it("updates persona systemPrompt", () => {
      const created = createPersona({ name: "Test" });
      const updated = updatePersona(created.id, {
        systemPrompt: "New prompt",
      });

      expect(updated?.systemPrompt).toBe("New prompt");
    });

    it("returns undefined for non-existent id", () => {
      const updated = updatePersona("non-existent", { name: "new-name" });

      expect(updated).toBeUndefined();
    });

    it("throws error for duplicate name", () => {
      createPersona({ name: "Persona 1" });
      const persona2 = createPersona({ name: "Persona 2" });

      expect(() => updatePersona(persona2.id, { name: "Persona 1" })).toThrow(
        'Persona with name "Persona 1" already exists'
      );
    });
  });

  describe("deletePersona", () => {
    it("deletes existing persona", () => {
      const created = createPersona({ name: "Test" });
      const deleted = deletePersona(created.id);

      expect(deleted).toBe(true);
      expect(getPersona(created.id)).toBeUndefined();
    });

    it("returns false for non-existent id", () => {
      const deleted = deletePersona("non-existent");

      expect(deleted).toBe(false);
    });
  });
});
