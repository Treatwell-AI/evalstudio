import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createConnector } from "../connector.js";
import {
  createEval,
  deleteEval,
  deleteEvalsByProject,
  getEval,
  getEvalByScenario,
  getEvalWithRelations,
  listEvals,
  updateEval,
} from "../eval.js";
import { createProject, deleteProject } from "../project.js";
import { createScenario, deleteScenario } from "../scenario.js";
import { resetStorageDir, setStorageDir } from "../storage.js";

let testDir: string;

describe("eval", () => {
  let projectId: string;
  let scenarioId: string;
  let scenario2Id: string;
  let connectorId: string;
  let connector2Id: string;
  const testProjectName = `eval-project-${Date.now()}`;

  beforeAll(() => {
    testDir = mkdtempSync(join(tmpdir(), "evalstudio-test-"));
    setStorageDir(testDir);
    // Create a project, scenarios, and connector for testing
    const project = createProject({ name: testProjectName });
    projectId = project.id;
    const scenario = createScenario({
      projectId,
      name: "Test Scenario",
      description: "A test scenario",
    });
    scenarioId = scenario.id;
    const scenario2 = createScenario({
      projectId,
      name: "Test Scenario 2",
      description: "Another test scenario",
    });
    scenario2Id = scenario2.id;
    const connector = createConnector({
      projectId,
      name: "Test Connector",
      type: "http",
      baseUrl: "http://localhost:3000",
    });
    connectorId = connector.id;
    const connector2 = createConnector({
      projectId,
      name: "Test Connector 2",
      type: "http",
      baseUrl: "http://localhost:3001",
    });
    connector2Id = connector2.id;
  });

  afterAll(() => {
    resetStorageDir();
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  beforeEach(() => {
    // Clean evals before each test
    const evalsPath = join(testDir, "evals.json");
    if (existsSync(evalsPath)) {
      rmSync(evalsPath);
    }
  });

  describe("createEval", () => {
    it("creates an eval with required fields", () => {
      const evalItem = createEval({ projectId, name: "Test Eval", connectorId, scenarioIds: [scenarioId] });

      expect(evalItem.id).toBeDefined();
      expect(evalItem.projectId).toBe(projectId);
      expect(evalItem.name).toBe("Test Eval");
      expect(evalItem.scenarioIds).toEqual([scenarioId]);
      expect(evalItem.input).toEqual([]);
      expect(evalItem.createdAt).toBeDefined();
      expect(evalItem.updatedAt).toBeDefined();
    });

    it("creates an eval with multiple scenarios", () => {
      const evalItem = createEval({
        projectId,
        name: "Multi-Scenario Eval",
        connectorId,
        scenarioIds: [scenarioId, scenario2Id],
      });

      expect(evalItem.scenarioIds).toEqual([scenarioId, scenario2Id]);
    });

    it("creates an eval with input messages", () => {
      const evalItem = createEval({
        projectId,
        name: "Messages Eval",
        connectorId,
        input: [{ role: "user", content: "Hello" }],
        scenarioIds: [scenarioId],
      });

      expect(evalItem.input).toEqual([{ role: "user", content: "Hello" }]);
      expect(evalItem.scenarioIds).toEqual([scenarioId]);
    });

    it("throws error for non-existent project", () => {
      expect(() =>
        createEval({ projectId: "non-existent", name: "Test", connectorId, scenarioIds: [scenarioId] })
      ).toThrow('Project with id "non-existent" not found');
    });

    it("throws error for non-existent connector", () => {
      expect(() =>
        createEval({ projectId, name: "Test", connectorId: "non-existent", scenarioIds: [scenarioId] })
      ).toThrow('Connector with id "non-existent" not found');
    });

    it("throws error for non-existent scenario", () => {
      expect(() =>
        createEval({ projectId, name: "Test", connectorId, scenarioIds: ["non-existent"] })
      ).toThrow('Scenario with id "non-existent" not found');
    });

    it("throws error for empty scenarioIds", () => {
      expect(() =>
        createEval({ projectId, name: "Test", connectorId, scenarioIds: [] })
      ).toThrow("At least one scenario is required");
    });

    it("throws error for scenario from different project", () => {
      const project2 = createProject({ name: `project-2-${Date.now()}` });
      const otherScenario = createScenario({
        projectId: project2.id,
        name: "Other Scenario",
      });
      try {
        expect(() =>
          createEval({ projectId, name: "Test", connectorId, scenarioIds: [otherScenario.id] })
        ).toThrow("Scenario does not belong to the specified project");
      } finally {
        deleteScenario(otherScenario.id);
        deleteProject(project2.id);
      }
    });

    it("allows multiple evals with different scenarios", () => {
      const eval1 = createEval({ projectId, name: "Eval 1", connectorId, scenarioIds: [scenarioId] });
      const eval2 = createEval({ projectId, name: "Eval 2", connectorId, scenarioIds: [scenario2Id] });

      expect(listEvals(projectId)).toHaveLength(2);
      expect(eval1.scenarioIds).toEqual([scenarioId]);
      expect(eval2.scenarioIds).toEqual([scenario2Id]);
    });
  });

  describe("getEval", () => {
    it("returns eval by id", () => {
      const created = createEval({ projectId, name: "Test", connectorId, scenarioIds: [scenarioId] });
      const found = getEval(created.id);

      expect(found).toEqual(created);
    });

    it("returns undefined for non-existent id", () => {
      const found = getEval("non-existent");

      expect(found).toBeUndefined();
    });
  });

  describe("getEvalByScenario", () => {
    it("returns eval by project and scenario", () => {
      const created = createEval({ projectId, name: "Test", connectorId, scenarioIds: [scenarioId] });
      const found = getEvalByScenario(projectId, scenarioId);

      expect(found).toEqual(created);
    });

    it("returns eval when scenario is in scenarioIds array", () => {
      const created = createEval({ projectId, name: "Test", connectorId, scenarioIds: [scenarioId, scenario2Id] });
      const found = getEvalByScenario(projectId, scenario2Id);

      expect(found).toEqual(created);
    });

    it("returns undefined for non-matching scenario", () => {
      createEval({ projectId, name: "Test", connectorId, scenarioIds: [scenarioId] });
      const found = getEvalByScenario(projectId, scenario2Id);

      expect(found).toBeUndefined();
    });
  });

  describe("getEvalWithRelations", () => {
    it("returns eval with scenarios relation", () => {
      const created = createEval({
        projectId,
        name: "Test",
        connectorId,
        scenarioIds: [scenarioId, scenario2Id],
      });
      const found = getEvalWithRelations(created.id);

      expect(found).toBeDefined();
      expect(found?.scenarios).toBeDefined();
      expect(found?.scenarios).toHaveLength(2);
      expect(found?.scenarios[0]?.id).toBe(scenarioId);
      expect(found?.scenarios[0]?.name).toBe("Test Scenario");
      expect(found?.scenarios[1]?.id).toBe(scenario2Id);
      expect(found?.scenarios[1]?.name).toBe("Test Scenario 2");
    });

    it("returns eval with connector relation", () => {
      const created = createEval({ projectId, name: "Test", connectorId, scenarioIds: [scenarioId] });
      const found = getEvalWithRelations(created.id);

      expect(found).toBeDefined();
      expect(found?.connector).toBeDefined();
      expect(found?.connector?.id).toBe(connectorId);
      expect(found?.connector?.name).toBe("Test Connector");
    });

    it("returns undefined for non-existent id", () => {
      const found = getEvalWithRelations("non-existent");

      expect(found).toBeUndefined();
    });
  });

  describe("listEvals", () => {
    it("returns empty array when no evals", () => {
      const evals = listEvals();

      expect(evals).toEqual([]);
    });

    it("returns all evals", () => {
      const eval1 = createEval({ projectId, name: "Eval 1", connectorId, scenarioIds: [scenarioId] });
      const eval2 = createEval({ projectId, name: "Eval 2", connectorId, scenarioIds: [scenario2Id] });

      const evals = listEvals();

      expect(evals).toHaveLength(2);
      expect(evals).toContainEqual(eval1);
      expect(evals).toContainEqual(eval2);
    });

    it("filters by project id", () => {
      const project2 = createProject({ name: `project-2-${Date.now()}` });
      const otherConnector = createConnector({
        projectId: project2.id,
        name: "Other Connector",
        type: "http",
        baseUrl: "http://localhost:3001",
      });
      const otherScenario = createScenario({
        projectId: project2.id,
        name: "Other Scenario",
      });
      try {
        createEval({ projectId, name: "Eval 1", connectorId, scenarioIds: [scenarioId] });
        const eval2 = createEval({
          projectId: project2.id,
          name: "Eval 2",
          connectorId: otherConnector.id,
          scenarioIds: [otherScenario.id],
        });

        const evals = listEvals(project2.id);

        expect(evals).toHaveLength(1);
        expect(evals[0]).toEqual(eval2);
      } finally {
        deleteProject(project2.id);
      }
    });
  });

  describe("updateEval", () => {
    it("updates eval name", () => {
      const created = createEval({ projectId, name: "Original Name", connectorId, scenarioIds: [scenarioId] });
      const updated = updateEval(created.id, { name: "Updated Name" });

      expect(updated?.name).toBe("Updated Name");
    });

    it("updates eval connectorId", async () => {
      const created = createEval({ projectId, name: "Test", connectorId, scenarioIds: [scenarioId] });
      await new Promise((resolve) => setTimeout(resolve, 10));
      const updated = updateEval(created.id, { connectorId: connector2Id });

      expect(updated?.connectorId).toBe(connector2Id);
      expect(new Date(updated!.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(created.updatedAt).getTime()
      );
    });

    it("updates eval input", () => {
      const created = createEval({ projectId, name: "Test", connectorId, scenarioIds: [scenarioId] });
      const updated = updateEval(created.id, {
        input: [{ role: "user", content: "Updated message" }],
      });

      expect(updated?.input).toEqual([{ role: "user", content: "Updated message" }]);
    });

    it("updates eval scenarioIds", () => {
      const created = createEval({ projectId, name: "Test", connectorId, scenarioIds: [scenarioId] });
      const updated = updateEval(created.id, { scenarioIds: [scenario2Id] });

      expect(updated?.scenarioIds).toEqual([scenario2Id]);
    });

    it("updates eval to multiple scenarios", () => {
      const created = createEval({ projectId, name: "Test", connectorId, scenarioIds: [scenarioId] });
      const updated = updateEval(created.id, { scenarioIds: [scenarioId, scenario2Id] });

      expect(updated?.scenarioIds).toEqual([scenarioId, scenario2Id]);
    });

    it("returns undefined for non-existent id", () => {
      const updated = updateEval("non-existent", { connectorId });

      expect(updated).toBeUndefined();
    });

    it("throws error for non-existent scenario", () => {
      const evalItem = createEval({ projectId, name: "Test", connectorId, scenarioIds: [scenarioId] });

      expect(() =>
        updateEval(evalItem.id, { scenarioIds: ["non-existent"] })
      ).toThrow('Scenario with id "non-existent" not found');
    });

    it("throws error for empty scenarioIds", () => {
      const evalItem = createEval({ projectId, name: "Test", connectorId, scenarioIds: [scenarioId] });

      expect(() =>
        updateEval(evalItem.id, { scenarioIds: [] })
      ).toThrow("At least one scenario is required");
    });
  });

  describe("deleteEval", () => {
    it("deletes existing eval", () => {
      const created = createEval({ projectId, name: "Test", connectorId, scenarioIds: [scenarioId] });
      const deleted = deleteEval(created.id);

      expect(deleted).toBe(true);
      expect(getEval(created.id)).toBeUndefined();
    });

    it("returns false for non-existent id", () => {
      const deleted = deleteEval("non-existent");

      expect(deleted).toBe(false);
    });
  });

  describe("deleteEvalsByProject", () => {
    it("deletes all evals for a project", () => {
      createEval({ projectId, name: "Eval 1", connectorId, scenarioIds: [scenarioId] });
      createEval({ projectId, name: "Eval 2", connectorId, scenarioIds: [scenario2Id] });

      const deletedCount = deleteEvalsByProject(projectId);

      expect(deletedCount).toBe(2);
      expect(listEvals(projectId)).toHaveLength(0);
    });

    it("does not delete evals from other projects", () => {
      const project2 = createProject({ name: `project-2-${Date.now()}` });
      const otherConnector = createConnector({
        projectId: project2.id,
        name: "Other Connector",
        type: "http",
        baseUrl: "http://localhost:3001",
      });
      const otherScenario = createScenario({
        projectId: project2.id,
        name: "Other Scenario",
      });
      try {
        createEval({ projectId, name: "Eval 1", connectorId, scenarioIds: [scenarioId] });
        const eval2 = createEval({
          projectId: project2.id,
          name: "Eval 2",
          connectorId: otherConnector.id,
          scenarioIds: [otherScenario.id],
        });

        deleteEvalsByProject(projectId);

        expect(listEvals(project2.id)).toEqual([eval2]);
      } finally {
        deleteProject(project2.id);
      }
    });

    it("returns 0 when no evals to delete", () => {
      const deletedCount = deleteEvalsByProject(projectId);

      expect(deletedCount).toBe(0);
    });
  });
});
