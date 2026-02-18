import { mkdtempSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createConnectorModule } from "../connector.js";
import { createEvalModule } from "../eval.js";
import { createScenarioModule } from "../scenario.js";
import type { ProjectContext } from "../project-resolver.js";

let tempDir: string;
let ctx: ProjectContext;
let evalMod: ReturnType<typeof createEvalModule>;
let scenarioMod: ReturnType<typeof createScenarioModule>;
let connectorMod: ReturnType<typeof createConnectorModule>;

let scenarioId: string;
let scenario2Id: string;
let connectorId: string;
let connector2Id: string;

describe("eval", () => {
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
    evalMod = createEvalModule(ctx);
    scenarioMod = createScenarioModule(ctx);
    connectorMod = createConnectorModule(ctx);

    const scenario = scenarioMod.create({ name: "Test Scenario" });
    scenarioId = scenario.id;
    const scenario2 = scenarioMod.create({ name: "Test Scenario 2" });
    scenario2Id = scenario2.id;
    const connector = connectorMod.create({
      name: "Test Connector",
      type: "http",
      baseUrl: "http://localhost:3000",
    });
    connectorId = connector.id;
    const connector2 = connectorMod.create({
      name: "Test Connector 2",
      type: "http",
      baseUrl: "http://localhost:3001",
    });
    connector2Id = connector2.id;
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe("create", () => {
    it("creates an eval with required fields", () => {
      const evalItem = evalMod.create({ name: "Test Eval", connectorId, scenarioIds: [scenarioId] });

      expect(evalItem.id).toBeDefined();
      expect(evalItem.name).toBe("Test Eval");
      expect(evalItem.scenarioIds).toEqual([scenarioId]);
      expect(evalItem.input).toEqual([]);
      expect(evalItem.createdAt).toBeDefined();
      expect(evalItem.updatedAt).toBeDefined();
    });

    it("creates an eval with multiple scenarios", () => {
      const evalItem = evalMod.create({
        name: "Multi-Scenario Eval",
        connectorId,
        scenarioIds: [scenarioId, scenario2Id],
      });

      expect(evalItem.scenarioIds).toEqual([scenarioId, scenario2Id]);
    });

    it("creates an eval with input messages", () => {
      const evalItem = evalMod.create({
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
        evalMod.create({ name: "Test", connectorId: "non-existent", scenarioIds: [scenarioId] })
      ).toThrow('Connector with id "non-existent" not found');
    });

    it("throws error for non-existent scenario", () => {
      expect(() =>
        evalMod.create({ name: "Test", connectorId, scenarioIds: ["non-existent"] })
      ).toThrow('Scenario with id "non-existent" not found');
    });

    it("throws error for empty scenarioIds", () => {
      expect(() =>
        evalMod.create({ name: "Test", connectorId, scenarioIds: [] })
      ).toThrow("At least one scenario is required");
    });

    it("allows multiple evals with different scenarios", () => {
      const eval1 = evalMod.create({ name: "Eval 1", connectorId, scenarioIds: [scenarioId] });
      const eval2 = evalMod.create({ name: "Eval 2", connectorId, scenarioIds: [scenario2Id] });

      expect(evalMod.list()).toHaveLength(2);
      expect(eval1.scenarioIds).toEqual([scenarioId]);
      expect(eval2.scenarioIds).toEqual([scenario2Id]);
    });
  });

  describe("get", () => {
    it("returns eval by id", () => {
      const created = evalMod.create({ name: "Test", connectorId, scenarioIds: [scenarioId] });
      const found = evalMod.get(created.id);

      expect(found).toEqual(created);
    });

    it("returns undefined for non-existent id", () => {
      const found = evalMod.get("non-existent");

      expect(found).toBeUndefined();
    });
  });

  describe("getByScenario", () => {
    it("returns eval by scenario", () => {
      const created = evalMod.create({ name: "Test", connectorId, scenarioIds: [scenarioId] });
      const found = evalMod.getByScenario(scenarioId);

      expect(found).toEqual(created);
    });

    it("returns eval when scenario is in scenarioIds array", () => {
      const created = evalMod.create({ name: "Test", connectorId, scenarioIds: [scenarioId, scenario2Id] });
      const found = evalMod.getByScenario(scenario2Id);

      expect(found).toEqual(created);
    });

    it("returns undefined for non-matching scenario", () => {
      evalMod.create({ name: "Test", connectorId, scenarioIds: [scenarioId] });
      const found = evalMod.getByScenario(scenario2Id);

      expect(found).toBeUndefined();
    });
  });

  describe("getWithRelations", () => {
    it("returns eval with scenarios relation", () => {
      const created = evalMod.create({
        name: "Test",
        connectorId,
        scenarioIds: [scenarioId, scenario2Id],
      });
      const found = evalMod.getWithRelations(created.id);

      expect(found).toBeDefined();
      expect(found?.scenarios).toBeDefined();
      expect(found?.scenarios).toHaveLength(2);
      expect(found?.scenarios[0]?.id).toBe(scenarioId);
      expect(found?.scenarios[0]?.name).toBe("Test Scenario");
      expect(found?.scenarios[1]?.id).toBe(scenario2Id);
      expect(found?.scenarios[1]?.name).toBe("Test Scenario 2");
    });

    it("returns eval with connector relation", () => {
      const created = evalMod.create({ name: "Test", connectorId, scenarioIds: [scenarioId] });
      const found = evalMod.getWithRelations(created.id);

      expect(found).toBeDefined();
      expect(found?.connector).toBeDefined();
      expect(found?.connector?.id).toBe(connectorId);
      expect(found?.connector?.name).toBe("Test Connector");
    });

    it("returns undefined for non-existent id", () => {
      const found = evalMod.getWithRelations("non-existent");

      expect(found).toBeUndefined();
    });
  });

  describe("list", () => {
    it("returns empty array when no evals", () => {
      const evals = evalMod.list();

      expect(evals).toEqual([]);
    });

    it("returns all evals", () => {
      const eval1 = evalMod.create({ name: "Eval 1", connectorId, scenarioIds: [scenarioId] });
      const eval2 = evalMod.create({ name: "Eval 2", connectorId, scenarioIds: [scenario2Id] });

      const evals = evalMod.list();

      expect(evals).toHaveLength(2);
      expect(evals).toContainEqual(eval1);
      expect(evals).toContainEqual(eval2);
    });
  });

  describe("update", () => {
    it("updates eval name", () => {
      const created = evalMod.create({ name: "Original Name", connectorId, scenarioIds: [scenarioId] });
      const updated = evalMod.update(created.id, { name: "Updated Name" });

      expect(updated?.name).toBe("Updated Name");
    });

    it("updates eval connectorId", async () => {
      const created = evalMod.create({ name: "Test", connectorId, scenarioIds: [scenarioId] });
      await new Promise((resolve) => setTimeout(resolve, 10));
      const updated = evalMod.update(created.id, { connectorId: connector2Id });

      expect(updated?.connectorId).toBe(connector2Id);
      expect(new Date(updated!.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(created.updatedAt).getTime()
      );
    });

    it("updates eval input", () => {
      const created = evalMod.create({ name: "Test", connectorId, scenarioIds: [scenarioId] });
      const updated = evalMod.update(created.id, {
        input: [{ role: "user", content: "Updated message" }],
      });

      expect(updated?.input).toEqual([{ role: "user", content: "Updated message" }]);
    });

    it("updates eval scenarioIds", () => {
      const created = evalMod.create({ name: "Test", connectorId, scenarioIds: [scenarioId] });
      const updated = evalMod.update(created.id, { scenarioIds: [scenario2Id] });

      expect(updated?.scenarioIds).toEqual([scenario2Id]);
    });

    it("updates eval to multiple scenarios", () => {
      const created = evalMod.create({ name: "Test", connectorId, scenarioIds: [scenarioId] });
      const updated = evalMod.update(created.id, { scenarioIds: [scenarioId, scenario2Id] });

      expect(updated?.scenarioIds).toEqual([scenarioId, scenario2Id]);
    });

    it("returns undefined for non-existent id", () => {
      const updated = evalMod.update("non-existent", { connectorId });

      expect(updated).toBeUndefined();
    });

    it("throws error for non-existent scenario", () => {
      const evalItem = evalMod.create({ name: "Test", connectorId, scenarioIds: [scenarioId] });

      expect(() =>
        evalMod.update(evalItem.id, { scenarioIds: ["non-existent"] })
      ).toThrow('Scenario with id "non-existent" not found');
    });

    it("throws error for empty scenarioIds", () => {
      const evalItem = evalMod.create({ name: "Test", connectorId, scenarioIds: [scenarioId] });

      expect(() =>
        evalMod.update(evalItem.id, { scenarioIds: [] })
      ).toThrow("At least one scenario is required");
    });
  });

  describe("delete", () => {
    it("deletes existing eval", () => {
      const created = evalMod.create({ name: "Test", connectorId, scenarioIds: [scenarioId] });
      const deleted = evalMod.delete(created.id);

      expect(deleted).toBe(true);
      expect(evalMod.get(created.id)).toBeUndefined();
    });

    it("returns false for non-existent id", () => {
      const deleted = evalMod.delete("non-existent");

      expect(deleted).toBe(false);
    });
  });
});
