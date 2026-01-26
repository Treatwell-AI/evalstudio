import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createPersona,
  deletePersona,
  deletePersonasByProject,
  getPersona,
  getPersonaByName,
  listPersonas,
  updatePersona,
} from "../persona.js";
import { createProject, deleteProject } from "../project.js";
import { resetStorageDir, setStorageDir } from "../storage.js";

let testDir: string;

describe("persona", () => {
  let projectId: string;
  const testProjectName = `persona-test-project-${Date.now()}`;

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
    // Clean personas before each test
    const personasPath = join(testDir, "personas.json");
    if (existsSync(personasPath)) {
      rmSync(personasPath);
    }
  });

  describe("createPersona", () => {
    it("creates a persona with required fields", () => {
      const persona = createPersona({ projectId, name: "Test Persona" });

      expect(persona.id).toBeDefined();
      expect(persona.projectId).toBe(projectId);
      expect(persona.name).toBe("Test Persona");
      expect(persona.description).toBeUndefined();
      expect(persona.systemPrompt).toBeUndefined();
      expect(persona.createdAt).toBeDefined();
      expect(persona.updatedAt).toBeDefined();
    });

    it("creates a persona with all fields", () => {
      const persona = createPersona({
        projectId,
        name: "Frustrated User",
        description: "A user who is impatient",
        systemPrompt: "You are a frustrated user...",
      });

      expect(persona.name).toBe("Frustrated User");
      expect(persona.description).toBe("A user who is impatient");
      expect(persona.systemPrompt).toBe("You are a frustrated user...");
    });

    it("throws error for non-existent project", () => {
      expect(() =>
        createPersona({ projectId: "non-existent", name: "Test" })
      ).toThrow('Project with id "non-existent" not found');
    });

    it("throws error for duplicate name in same project", () => {
      createPersona({ projectId, name: "Test Persona" });

      expect(() => createPersona({ projectId, name: "Test Persona" })).toThrow(
        'Persona with name "Test Persona" already exists in this project'
      );
    });

    it("allows same name in different projects", () => {
      const project2 = createProject({ name: `project-2-${Date.now()}` });
      try {
        createPersona({ projectId, name: "Test Persona" });

        const persona2 = createPersona({
          projectId: project2.id,
          name: "Test Persona",
        });

        expect(persona2.name).toBe("Test Persona");
      } finally {
        deleteProject(project2.id);
      }
    });
  });

  describe("getPersona", () => {
    it("returns persona by id", () => {
      const created = createPersona({ projectId, name: "Test Persona" });
      const found = getPersona(created.id);

      expect(found).toEqual(created);
    });

    it("returns undefined for non-existent id", () => {
      const found = getPersona("non-existent");

      expect(found).toBeUndefined();
    });
  });

  describe("getPersonaByName", () => {
    it("returns persona by project and name", () => {
      const created = createPersona({ projectId, name: "Test Persona" });
      const found = getPersonaByName(projectId, "Test Persona");

      expect(found).toEqual(created);
    });

    it("returns undefined for non-existent name", () => {
      const found = getPersonaByName(projectId, "non-existent");

      expect(found).toBeUndefined();
    });
  });

  describe("listPersonas", () => {
    it("returns empty array when no personas", () => {
      const personas = listPersonas();

      expect(personas).toEqual([]);
    });

    it("returns all personas", () => {
      const persona1 = createPersona({ projectId, name: "Persona 1" });
      const persona2 = createPersona({ projectId, name: "Persona 2" });

      const personas = listPersonas();

      expect(personas).toHaveLength(2);
      expect(personas).toContainEqual(persona1);
      expect(personas).toContainEqual(persona2);
    });

    it("filters by project id", () => {
      const project2 = createProject({ name: `project-2-${Date.now()}` });
      try {
        createPersona({ projectId, name: "Persona 1" });
        const persona2 = createPersona({
          projectId: project2.id,
          name: "Persona 2",
        });

        const personas = listPersonas(project2.id);

        expect(personas).toHaveLength(1);
        expect(personas[0]).toEqual(persona2);
      } finally {
        deleteProject(project2.id);
      }
    });
  });

  describe("updatePersona", () => {
    it("updates persona name", async () => {
      const created = createPersona({ projectId, name: "Old Name" });
      // Small delay to ensure timestamp changes
      await new Promise((resolve) => setTimeout(resolve, 10));
      const updated = updatePersona(created.id, { name: "New Name" });

      expect(updated?.name).toBe("New Name");
      expect(new Date(updated!.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(created.updatedAt).getTime()
      );
    });

    it("updates persona description", () => {
      const created = createPersona({ projectId, name: "Test" });
      const updated = updatePersona(created.id, {
        description: "New description",
      });

      expect(updated?.description).toBe("New description");
    });

    it("updates persona systemPrompt", () => {
      const created = createPersona({ projectId, name: "Test" });
      const updated = updatePersona(created.id, {
        systemPrompt: "New prompt",
      });

      expect(updated?.systemPrompt).toBe("New prompt");
    });

    it("returns undefined for non-existent id", () => {
      const updated = updatePersona("non-existent", { name: "new-name" });

      expect(updated).toBeUndefined();
    });

    it("throws error for duplicate name in same project", () => {
      createPersona({ projectId, name: "Persona 1" });
      const persona2 = createPersona({ projectId, name: "Persona 2" });

      expect(() => updatePersona(persona2.id, { name: "Persona 1" })).toThrow(
        'Persona with name "Persona 1" already exists in this project'
      );
    });
  });

  describe("deletePersona", () => {
    it("deletes existing persona", () => {
      const created = createPersona({ projectId, name: "Test" });
      const deleted = deletePersona(created.id);

      expect(deleted).toBe(true);
      expect(getPersona(created.id)).toBeUndefined();
    });

    it("returns false for non-existent id", () => {
      const deleted = deletePersona("non-existent");

      expect(deleted).toBe(false);
    });
  });

  describe("deletePersonasByProject", () => {
    it("deletes all personas for a project", () => {
      createPersona({ projectId, name: "Persona 1" });
      createPersona({ projectId, name: "Persona 2" });

      const deletedCount = deletePersonasByProject(projectId);

      expect(deletedCount).toBe(2);
      expect(listPersonas(projectId)).toHaveLength(0);
    });

    it("does not delete personas from other projects", () => {
      const project2 = createProject({ name: `project-2-${Date.now()}` });
      try {
        createPersona({ projectId, name: "Persona 1" });
        const persona2 = createPersona({
          projectId: project2.id,
          name: "Persona 2",
        });

        deletePersonasByProject(projectId);

        expect(listPersonas(project2.id)).toEqual([persona2]);
      } finally {
        deleteProject(project2.id);
      }
    });

    it("returns 0 when no personas to delete", () => {
      const deletedCount = deletePersonasByProject(projectId);

      expect(deletedCount).toBe(0);
    });
  });
});
