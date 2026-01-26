import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createProject,
  deleteProject,
  getProject,
  getProjectByName,
  listProjects,
  updateProject,
} from "../project.js";
import { resetStorageDir, setStorageDir } from "../storage.js";

let testDir: string;

describe("project", () => {
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
    const storagePath = join(testDir, "projects.json");
    if (existsSync(storagePath)) {
      rmSync(storagePath);
    }
  });

  afterEach(() => {
    const storagePath = join(testDir, "projects.json");
    if (existsSync(storagePath)) {
      rmSync(storagePath);
    }
  });

  describe("createProject", () => {
    it("creates a project with required fields", () => {
      const project = createProject({ name: "test-project" });

      expect(project.id).toBeDefined();
      expect(project.name).toBe("test-project");
      expect(project.description).toBeUndefined();
      expect(project.createdAt).toBeDefined();
      expect(project.updatedAt).toBeDefined();
    });

    it("creates a project with description", () => {
      const project = createProject({
        name: "test-project",
        description: "A test project",
      });

      expect(project.name).toBe("test-project");
      expect(project.description).toBe("A test project");
    });

    it("throws error for duplicate name", () => {
      createProject({ name: "test-project" });

      expect(() => createProject({ name: "test-project" })).toThrow(
        'Project with name "test-project" already exists'
      );
    });
  });

  describe("getProject", () => {
    it("returns project by id", () => {
      const created = createProject({ name: "test-project" });
      const found = getProject(created.id);

      expect(found).toEqual(created);
    });

    it("returns undefined for non-existent id", () => {
      const found = getProject("non-existent");

      expect(found).toBeUndefined();
    });
  });

  describe("getProjectByName", () => {
    it("returns project by name", () => {
      const created = createProject({ name: "test-project" });
      const found = getProjectByName("test-project");

      expect(found).toEqual(created);
    });

    it("returns undefined for non-existent name", () => {
      const found = getProjectByName("non-existent");

      expect(found).toBeUndefined();
    });
  });

  describe("listProjects", () => {
    it("returns empty array when no projects", () => {
      const projects = listProjects();

      expect(projects).toEqual([]);
    });

    it("returns all projects", () => {
      const project1 = createProject({ name: "project-1" });
      const project2 = createProject({ name: "project-2" });

      const projects = listProjects();

      expect(projects).toHaveLength(2);
      expect(projects).toContainEqual(project1);
      expect(projects).toContainEqual(project2);
    });
  });

  describe("updateProject", () => {
    it("updates project name", async () => {
      const created = createProject({ name: "old-name" });
      // Small delay to ensure timestamp changes
      await new Promise((resolve) => setTimeout(resolve, 10));
      const updated = updateProject(created.id, { name: "new-name" });

      expect(updated?.name).toBe("new-name");
      expect(new Date(updated!.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(created.updatedAt).getTime()
      );
    });

    it("updates project description", () => {
      const created = createProject({ name: "test-project" });
      const updated = updateProject(created.id, {
        description: "New description",
      });

      expect(updated?.description).toBe("New description");
    });

    it("returns undefined for non-existent id", () => {
      const updated = updateProject("non-existent", { name: "new-name" });

      expect(updated).toBeUndefined();
    });

    it("throws error for duplicate name", () => {
      createProject({ name: "project-1" });
      const project2 = createProject({ name: "project-2" });

      expect(() => updateProject(project2.id, { name: "project-1" })).toThrow(
        'Project with name "project-1" already exists'
      );
    });
  });

  describe("deleteProject", () => {
    it("deletes existing project", () => {
      const created = createProject({ name: "test-project" });
      const deleted = deleteProject(created.id);

      expect(deleted).toBe(true);
      expect(getProject(created.id)).toBeUndefined();
    });

    it("returns false for non-existent id", () => {
      const deleted = deleteProject("non-existent");

      expect(deleted).toBe(false);
    });
  });
});
