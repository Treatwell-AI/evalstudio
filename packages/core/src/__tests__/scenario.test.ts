import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createScenario,
  deleteScenario,
  deleteScenariosByProject,
  getScenario,
  getScenarioByName,
  listScenarios,
  updateScenario,
} from "../scenario.js";
import { createProject, deleteProject } from "../project.js";
import { resetStorageDir, setStorageDir } from "../storage.js";

let testDir: string;

describe("scenario", () => {
  let projectId: string;
  const testProjectName = `scenario-test-project-${Date.now()}`;

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
    // Clean scenarios before each test
    const scenariosPath = join(testDir, "scenarios.json");
    if (existsSync(scenariosPath)) {
      rmSync(scenariosPath);
    }
  });

  describe("createScenario", () => {
    it("creates a scenario with required fields", () => {
      const scenario = createScenario({ projectId, name: "Test Scenario" });

      expect(scenario.id).toBeDefined();
      expect(scenario.projectId).toBe(projectId);
      expect(scenario.name).toBe("Test Scenario");
      expect(scenario.instructions).toBeUndefined();
      expect(scenario.createdAt).toBeDefined();
      expect(scenario.updatedAt).toBeDefined();
    });

    it("creates a scenario with all fields", () => {
      const scenario = createScenario({
        projectId,
        name: "Booking Cancellation",
        instructions: "Customer wants to cancel a haircut appointment for tomorrow. They have a scheduling conflict. Booking was made 3 days ago with 24h cancellation policy.",
        maxMessages: 10,
        successCriteria: "Customer successfully cancels their appointment",
        failureCriteria: "Agent fails to help or provides incorrect information",
        failureCriteriaMode: "on_max_messages",
      });

      expect(scenario.name).toBe("Booking Cancellation");
      expect(scenario.instructions).toBe("Customer wants to cancel a haircut appointment for tomorrow. They have a scheduling conflict. Booking was made 3 days ago with 24h cancellation policy.");
      expect(scenario.maxMessages).toBe(10);
      expect(scenario.successCriteria).toBe("Customer successfully cancels their appointment");
      expect(scenario.failureCriteria).toBe("Agent fails to help or provides incorrect information");
      expect(scenario.failureCriteriaMode).toBe("on_max_messages");
    });

    it("creates a scenario with failureCriteriaMode defaults to undefined", () => {
      const scenario = createScenario({
        projectId,
        name: "Default Mode Scenario",
        failureCriteria: "Agent provides wrong info",
      });

      expect(scenario.failureCriteriaMode).toBeUndefined();
    });

    it("creates a scenario with initial messages", () => {
      const messages = [
        { role: "user" as const, content: "Hi, I need to cancel my appointment" },
        { role: "assistant" as const, content: "I'd be happy to help you cancel your appointment. Can you provide your booking reference?" },
        { role: "user" as const, content: "It's ABC123" },
      ];

      const scenario = createScenario({
        projectId,
        name: "Mid-conversation Cancellation",
        instructions: "Continue the cancellation flow from this point",
        messages,
      });

      expect(scenario.messages).toEqual(messages);
      expect(scenario.messages).toHaveLength(3);
    });

    it("throws error for non-existent project", () => {
      expect(() =>
        createScenario({ projectId: "non-existent", name: "Test" })
      ).toThrow('Project with id "non-existent" not found');
    });

    it("throws error for duplicate name in same project", () => {
      createScenario({ projectId, name: "Test Scenario" });

      expect(() => createScenario({ projectId, name: "Test Scenario" })).toThrow(
        'Scenario with name "Test Scenario" already exists in this project'
      );
    });

    it("allows same name in different projects", () => {
      const project2 = createProject({ name: `project-2-${Date.now()}` });
      try {
        createScenario({ projectId, name: "Test Scenario" });

        const scenario2 = createScenario({
          projectId: project2.id,
          name: "Test Scenario",
        });

        expect(scenario2.name).toBe("Test Scenario");
      } finally {
        deleteProject(project2.id);
      }
    });
  });

  describe("getScenario", () => {
    it("returns scenario by id", () => {
      const created = createScenario({ projectId, name: "Test Scenario" });
      const found = getScenario(created.id);

      expect(found).toEqual(created);
    });

    it("returns undefined for non-existent id", () => {
      const found = getScenario("non-existent");

      expect(found).toBeUndefined();
    });
  });

  describe("getScenarioByName", () => {
    it("returns scenario by project and name", () => {
      const created = createScenario({ projectId, name: "Test Scenario" });
      const found = getScenarioByName(projectId, "Test Scenario");

      expect(found).toEqual(created);
    });

    it("returns undefined for non-existent name", () => {
      const found = getScenarioByName(projectId, "non-existent");

      expect(found).toBeUndefined();
    });
  });

  describe("listScenarios", () => {
    it("returns empty array when no scenarios", () => {
      const scenarios = listScenarios();

      expect(scenarios).toEqual([]);
    });

    it("returns all scenarios", () => {
      const scenario1 = createScenario({ projectId, name: "Scenario 1" });
      const scenario2 = createScenario({ projectId, name: "Scenario 2" });

      const scenarios = listScenarios();

      expect(scenarios).toHaveLength(2);
      expect(scenarios).toContainEqual(scenario1);
      expect(scenarios).toContainEqual(scenario2);
    });

    it("filters by project id", () => {
      const project2 = createProject({ name: `project-2-${Date.now()}` });
      try {
        createScenario({ projectId, name: "Scenario 1" });
        const scenario2 = createScenario({
          projectId: project2.id,
          name: "Scenario 2",
        });

        const scenarios = listScenarios(project2.id);

        expect(scenarios).toHaveLength(1);
        expect(scenarios[0]).toEqual(scenario2);
      } finally {
        deleteProject(project2.id);
      }
    });
  });

  describe("updateScenario", () => {
    it("updates scenario name", async () => {
      const created = createScenario({ projectId, name: "Old Name" });
      // Small delay to ensure timestamp changes
      await new Promise((resolve) => setTimeout(resolve, 10));
      const updated = updateScenario(created.id, { name: "New Name" });

      expect(updated?.name).toBe("New Name");
      expect(new Date(updated!.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(created.updatedAt).getTime()
      );
    });

    it("updates scenario instructions", () => {
      const created = createScenario({ projectId, name: "Test" });
      const updated = updateScenario(created.id, {
        instructions: "New instructions",
      });

      expect(updated?.instructions).toBe("New instructions");
    });

    it("updates scenario messages", () => {
      const created = createScenario({
        projectId,
        name: "Test",
        messages: [{ role: "user", content: "Hello" }],
      });

      const newMessages = [
        { role: "user" as const, content: "Hello" },
        { role: "assistant" as const, content: "Hi there!" },
        { role: "user" as const, content: "I need help" },
      ];

      const updated = updateScenario(created.id, { messages: newMessages });

      expect(updated?.messages).toEqual(newMessages);
      expect(updated?.messages).toHaveLength(3);
    });

    it("updates scenario maxMessages", () => {
      const created = createScenario({ projectId, name: "Test" });
      const updated = updateScenario(created.id, { maxMessages: 15 });

      expect(updated?.maxMessages).toBe(15);
    });

    it("updates scenario successCriteria", () => {
      const created = createScenario({ projectId, name: "Test" });
      const updated = updateScenario(created.id, { successCriteria: "New success criteria" });

      expect(updated?.successCriteria).toBe("New success criteria");
    });

    it("updates scenario failureCriteria", () => {
      const created = createScenario({ projectId, name: "Test" });
      const updated = updateScenario(created.id, { failureCriteria: "New failure criteria" });

      expect(updated?.failureCriteria).toBe("New failure criteria");
    });

    it("updates scenario failureCriteriaMode", () => {
      const created = createScenario({ projectId, name: "Test" });
      const updated = updateScenario(created.id, { failureCriteriaMode: "on_max_messages" });

      expect(updated?.failureCriteriaMode).toBe("on_max_messages");
    });

    it("updates scenario failureCriteriaMode to every_turn", () => {
      const created = createScenario({
        projectId,
        name: "Test",
        failureCriteriaMode: "on_max_messages",
      });
      const updated = updateScenario(created.id, { failureCriteriaMode: "every_turn" });

      expect(updated?.failureCriteriaMode).toBe("every_turn");
    });

    it("returns undefined for non-existent id", () => {
      const updated = updateScenario("non-existent", { name: "new-name" });

      expect(updated).toBeUndefined();
    });

    it("throws error for duplicate name in same project", () => {
      createScenario({ projectId, name: "Scenario 1" });
      const scenario2 = createScenario({ projectId, name: "Scenario 2" });

      expect(() => updateScenario(scenario2.id, { name: "Scenario 1" })).toThrow(
        'Scenario with name "Scenario 1" already exists in this project'
      );
    });
  });

  describe("deleteScenario", () => {
    it("deletes existing scenario", () => {
      const created = createScenario({ projectId, name: "Test" });
      const deleted = deleteScenario(created.id);

      expect(deleted).toBe(true);
      expect(getScenario(created.id)).toBeUndefined();
    });

    it("returns false for non-existent id", () => {
      const deleted = deleteScenario("non-existent");

      expect(deleted).toBe(false);
    });
  });

  describe("deleteScenariosByProject", () => {
    it("deletes all scenarios for a project", () => {
      createScenario({ projectId, name: "Scenario 1" });
      createScenario({ projectId, name: "Scenario 2" });

      const deletedCount = deleteScenariosByProject(projectId);

      expect(deletedCount).toBe(2);
      expect(listScenarios(projectId)).toHaveLength(0);
    });

    it("does not delete scenarios from other projects", () => {
      const project2 = createProject({ name: `project-2-${Date.now()}` });
      try {
        createScenario({ projectId, name: "Scenario 1" });
        const scenario2 = createScenario({
          projectId: project2.id,
          name: "Scenario 2",
        });

        deleteScenariosByProject(projectId);

        expect(listScenarios(project2.id)).toEqual([scenario2]);
      } finally {
        deleteProject(project2.id);
      }
    });

    it("returns 0 when no scenarios to delete", () => {
      const deletedCount = deleteScenariosByProject(projectId);

      expect(deletedCount).toBe(0);
    });
  });
});
