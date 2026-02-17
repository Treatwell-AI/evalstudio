import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createConnector } from "../connector.js";
import {
  createEval,
  deleteEval,
  getEval,
  getEvalByScenario,
  getEvalWithRelations,
  listEvals,
  updateEval,
} from "../eval.js";
import { createScenario } from "../scenario.js";
import { resetStorageDir, setStorageDir } from "../project-resolver.js";

let testDir: string;

describe("eval", () => {
  let scenarioId: string;
  let scenario2Id: string;
  let connectorId: string;
  let connector2Id: string;

  beforeAll(() => {
    testDir = mkdtempSync(join(tmpdir(), "evalstudio-test-"));
    setStorageDir(testDir);
    const scenario = createScenario({
      name: "Test Scenario",
    });
    scenarioId = scenario.id;
    const scenario2 = createScenario({
      name: "Test Scenario 2",
    });
    scenario2Id = scenario2.id;
    const connector = createConnector({
      name: "Test Connector",
      type: "http",
      baseUrl: "http://localhost:3000",
    });
    connectorId = connector.id;
    const connector2 = createConnector({
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
      const evalItem = createEval({ name: "Test Eval", connectorId, scenarioIds: [scenarioId] });

      expect(evalItem.id).toBeDefined();
      expect(evalItem.name).toBe("Test Eval");
      expect(evalItem.scenarioIds).toEqual([scenarioId]);
      expect(evalItem.input).toEqual([]);
      expect(evalItem.createdAt).toBeDefined();
      expect(evalItem.updatedAt).toBeDefined();
    });

    it("creates an eval with multiple scenarios", () => {
      const evalItem = createEval({
        name: "Multi-Scenario Eval",
        connectorId,
        scenarioIds: [scenarioId, scenario2Id],
      });

      expect(evalItem.scenarioIds).toEqual([scenarioId, scenario2Id]);
    });

    it("creates an eval with input messages", () => {
      const evalItem = createEval({
        name: "Messages Eval",
        connectorId,
        input: [{ role: "user", content: "Hello" }],
        scenarioIds: [scenarioId],
      });

      expect(evalItem.input).toEqual([{ role: "user", content: "Hello" }]);
      expect(evalItem.scenarioIds).toEqual([scenarioId]);
    });

    it("throws error for non-existent connector", () => {
      expect(() =>
        createEval({ name: "Test", connectorId: "non-existent", scenarioIds: [scenarioId] })
      ).toThrow('Connector with id "non-existent" not found');
    });

    it("throws error for non-existent scenario", () => {
      expect(() =>
        createEval({ name: "Test", connectorId, scenarioIds: ["non-existent"] })
      ).toThrow('Scenario with id "non-existent" not found');
    });

    it("throws error for empty scenarioIds", () => {
      expect(() =>
        createEval({ name: "Test", connectorId, scenarioIds: [] })
      ).toThrow("At least one scenario is required");
    });

    it("allows multiple evals with different scenarios", () => {
      const eval1 = createEval({ name: "Eval 1", connectorId, scenarioIds: [scenarioId] });
      const eval2 = createEval({ name: "Eval 2", connectorId, scenarioIds: [scenario2Id] });

      expect(listEvals()).toHaveLength(2);
      expect(eval1.scenarioIds).toEqual([scenarioId]);
      expect(eval2.scenarioIds).toEqual([scenario2Id]);
    });
  });

  describe("getEval", () => {
    it("returns eval by id", () => {
      const created = createEval({ name: "Test", connectorId, scenarioIds: [scenarioId] });
      const found = getEval(created.id);

      expect(found).toEqual(created);
    });

    it("returns undefined for non-existent id", () => {
      const found = getEval("non-existent");

      expect(found).toBeUndefined();
    });
  });

  describe("getEvalByScenario", () => {
    it("returns eval by scenario", () => {
      const created = createEval({ name: "Test", connectorId, scenarioIds: [scenarioId] });
      const found = getEvalByScenario(scenarioId);

      expect(found).toEqual(created);
    });

    it("returns eval when scenario is in scenarioIds array", () => {
      const created = createEval({ name: "Test", connectorId, scenarioIds: [scenarioId, scenario2Id] });
      const found = getEvalByScenario(scenario2Id);

      expect(found).toEqual(created);
    });

    it("returns undefined for non-matching scenario", () => {
      createEval({ name: "Test", connectorId, scenarioIds: [scenarioId] });
      const found = getEvalByScenario(scenario2Id);

      expect(found).toBeUndefined();
    });
  });

  describe("getEvalWithRelations", () => {
    it("returns eval with scenarios relation", () => {
      const created = createEval({
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
      const created = createEval({ name: "Test", connectorId, scenarioIds: [scenarioId] });
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
      const eval1 = createEval({ name: "Eval 1", connectorId, scenarioIds: [scenarioId] });
      const eval2 = createEval({ name: "Eval 2", connectorId, scenarioIds: [scenario2Id] });

      const evals = listEvals();

      expect(evals).toHaveLength(2);
      expect(evals).toContainEqual(eval1);
      expect(evals).toContainEqual(eval2);
    });
  });

  describe("updateEval", () => {
    it("updates eval name", () => {
      const created = createEval({ name: "Original Name", connectorId, scenarioIds: [scenarioId] });
      const updated = updateEval(created.id, { name: "Updated Name" });

      expect(updated?.name).toBe("Updated Name");
    });

    it("updates eval connectorId", async () => {
      const created = createEval({ name: "Test", connectorId, scenarioIds: [scenarioId] });
      await new Promise((resolve) => setTimeout(resolve, 10));
      const updated = updateEval(created.id, { connectorId: connector2Id });

      expect(updated?.connectorId).toBe(connector2Id);
      expect(new Date(updated!.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(created.updatedAt).getTime()
      );
    });

    it("updates eval input", () => {
      const created = createEval({ name: "Test", connectorId, scenarioIds: [scenarioId] });
      const updated = updateEval(created.id, {
        input: [{ role: "user", content: "Updated message" }],
      });

      expect(updated?.input).toEqual([{ role: "user", content: "Updated message" }]);
    });

    it("updates eval scenarioIds", () => {
      const created = createEval({ name: "Test", connectorId, scenarioIds: [scenarioId] });
      const updated = updateEval(created.id, { scenarioIds: [scenario2Id] });

      expect(updated?.scenarioIds).toEqual([scenario2Id]);
    });

    it("updates eval to multiple scenarios", () => {
      const created = createEval({ name: "Test", connectorId, scenarioIds: [scenarioId] });
      const updated = updateEval(created.id, { scenarioIds: [scenarioId, scenario2Id] });

      expect(updated?.scenarioIds).toEqual([scenarioId, scenario2Id]);
    });

    it("returns undefined for non-existent id", () => {
      const updated = updateEval("non-existent", { connectorId });

      expect(updated).toBeUndefined();
    });

    it("throws error for non-existent scenario", () => {
      const evalItem = createEval({ name: "Test", connectorId, scenarioIds: [scenarioId] });

      expect(() =>
        updateEval(evalItem.id, { scenarioIds: ["non-existent"] })
      ).toThrow('Scenario with id "non-existent" not found');
    });

    it("throws error for empty scenarioIds", () => {
      const evalItem = createEval({ name: "Test", connectorId, scenarioIds: [scenarioId] });

      expect(() =>
        updateEval(evalItem.id, { scenarioIds: [] })
      ).toThrow("At least one scenario is required");
    });
  });

  describe("deleteEval", () => {
    it("deletes existing eval", () => {
      const created = createEval({ name: "Test", connectorId, scenarioIds: [scenarioId] });
      const deleted = deleteEval(created.id);

      expect(deleted).toBe(true);
      expect(getEval(created.id)).toBeUndefined();
    });

    it("returns false for non-existent id", () => {
      const deleted = deleteEval("non-existent");

      expect(deleted).toBe(false);
    });
  });
});
