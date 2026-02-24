import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createProjectModules, type EvalModule, type ScenarioModule, type ConnectorModule } from "../index.js";
import { createFilesystemStorage } from "../filesystem-storage.js";
import type { StorageProvider } from "../storage-provider.js";

const projectId = "test-project-id";
let tempDir: string;
let storage: StorageProvider;
let evalMod: EvalModule;
let scenarioMod: ScenarioModule;
let connectorMod: ConnectorModule;

let scenarioId: string;
let scenario2Id: string;
let connectorId: string;
let connector2Id: string;

describe("eval", () => {
  beforeEach(async () => {
    tempDir = mkdtempSync(join(tmpdir(), "evalstudio-test-"));
    mkdirSync(join(tempDir, "projects", projectId, "data"), { recursive: true });
    storage = createFilesystemStorage(tempDir);
    const modules = createProjectModules(storage, projectId);
    evalMod = modules.evals;
    scenarioMod = modules.scenarios;
    connectorMod = modules.connectors;

    const scenario = await scenarioMod.create({ name: "Test Scenario" });
    scenarioId = scenario.id;
    const scenario2 = await scenarioMod.create({ name: "Test Scenario 2" });
    scenario2Id = scenario2.id;
    const connector = await connectorMod.create({
      name: "Test Connector",
      type: "http",
      baseUrl: "http://localhost:3000",
    });
    connectorId = connector.id;
    const connector2 = await connectorMod.create({
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
    it("creates an eval with required fields", async () => {
      const evalItem = await evalMod.create({ name: "Test Eval", connectorId, scenarioIds: [scenarioId] });

      expect(evalItem.id).toBeDefined();
      expect(evalItem.name).toBe("Test Eval");
      expect(evalItem.scenarioIds).toEqual([scenarioId]);
      expect(evalItem.createdAt).toBeDefined();
      expect(evalItem.updatedAt).toBeDefined();
    });

    it("creates an eval with multiple scenarios", async () => {
      const evalItem = await evalMod.create({
        name: "Multi-Scenario Eval",
        connectorId,
        scenarioIds: [scenarioId, scenario2Id],
      });

      expect(evalItem.scenarioIds).toEqual([scenarioId, scenario2Id]);
    });

    it("throws error for non-existent connector", async () => {
      await expect(
        evalMod.create({ name: "Test", connectorId: "non-existent", scenarioIds: [scenarioId] })
      ).rejects.toThrow('Connector with id "non-existent" not found');
    });

    it("throws error for non-existent scenario", async () => {
      await expect(
        evalMod.create({ name: "Test", connectorId, scenarioIds: ["non-existent"] })
      ).rejects.toThrow('Scenario with id "non-existent" not found');
    });

    it("throws error for empty scenarioIds", async () => {
      await expect(
        evalMod.create({ name: "Test", connectorId, scenarioIds: [] })
      ).rejects.toThrow("At least one scenario is required");
    });

    it("allows multiple evals with different scenarios", async () => {
      const eval1 = await evalMod.create({ name: "Eval 1", connectorId, scenarioIds: [scenarioId] });
      const eval2 = await evalMod.create({ name: "Eval 2", connectorId, scenarioIds: [scenario2Id] });

      expect(await evalMod.list()).toHaveLength(2);
      expect(eval1.scenarioIds).toEqual([scenarioId]);
      expect(eval2.scenarioIds).toEqual([scenario2Id]);
    });
  });

  describe("get", () => {
    it("returns eval by id", async () => {
      const created = await evalMod.create({ name: "Test", connectorId, scenarioIds: [scenarioId] });
      const found = await evalMod.get(created.id);

      expect(found).toEqual(created);
    });

    it("returns undefined for non-existent id", async () => {
      const found = await evalMod.get("non-existent");

      expect(found).toBeUndefined();
    });
  });

  describe("getByScenario", () => {
    it("returns eval by scenario", async () => {
      const created = await evalMod.create({ name: "Test", connectorId, scenarioIds: [scenarioId] });
      const found = await evalMod.getByScenario(scenarioId);

      expect(found).toEqual(created);
    });

    it("returns eval when scenario is in scenarioIds array", async () => {
      const created = await evalMod.create({ name: "Test", connectorId, scenarioIds: [scenarioId, scenario2Id] });
      const found = await evalMod.getByScenario(scenario2Id);

      expect(found).toEqual(created);
    });

    it("returns undefined for non-matching scenario", async () => {
      await evalMod.create({ name: "Test", connectorId, scenarioIds: [scenarioId] });
      const found = await evalMod.getByScenario(scenario2Id);

      expect(found).toBeUndefined();
    });
  });

  describe("getWithRelations", () => {
    it("returns eval with scenarios relation", async () => {
      const created = await evalMod.create({
        name: "Test",
        connectorId,
        scenarioIds: [scenarioId, scenario2Id],
      });
      const found = await evalMod.getWithRelations(created.id);

      expect(found).toBeDefined();
      expect(found?.scenarios).toBeDefined();
      expect(found?.scenarios).toHaveLength(2);
      expect(found?.scenarios[0]?.id).toBe(scenarioId);
      expect(found?.scenarios[0]?.name).toBe("Test Scenario");
      expect(found?.scenarios[1]?.id).toBe(scenario2Id);
      expect(found?.scenarios[1]?.name).toBe("Test Scenario 2");
    });

    it("returns eval with connector relation", async () => {
      const created = await evalMod.create({ name: "Test", connectorId, scenarioIds: [scenarioId] });
      const found = await evalMod.getWithRelations(created.id);

      expect(found).toBeDefined();
      expect(found?.connector).toBeDefined();
      expect(found?.connector?.id).toBe(connectorId);
      expect(found?.connector?.name).toBe("Test Connector");
    });

    it("returns undefined for non-existent id", async () => {
      const found = await evalMod.getWithRelations("non-existent");

      expect(found).toBeUndefined();
    });
  });

  describe("list", () => {
    it("returns empty array when no evals", async () => {
      const evals = await evalMod.list();

      expect(evals).toEqual([]);
    });

    it("returns all evals", async () => {
      const eval1 = await evalMod.create({ name: "Eval 1", connectorId, scenarioIds: [scenarioId] });
      const eval2 = await evalMod.create({ name: "Eval 2", connectorId, scenarioIds: [scenario2Id] });

      const evals = await evalMod.list();

      expect(evals).toHaveLength(2);
      expect(evals).toContainEqual(eval1);
      expect(evals).toContainEqual(eval2);
    });
  });

  describe("update", () => {
    it("updates eval name", async () => {
      const created = await evalMod.create({ name: "Original Name", connectorId, scenarioIds: [scenarioId] });
      const updated = await evalMod.update(created.id, { name: "Updated Name" });

      expect(updated?.name).toBe("Updated Name");
    });

    it("updates eval connectorId", async () => {
      const created = await evalMod.create({ name: "Test", connectorId, scenarioIds: [scenarioId] });
      await new Promise((resolve) => setTimeout(resolve, 10));
      const updated = await evalMod.update(created.id, { connectorId: connector2Id });

      expect(updated?.connectorId).toBe(connector2Id);
      expect(new Date(updated!.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(created.updatedAt).getTime()
      );
    });

    it("updates eval scenarioIds", async () => {
      const created = await evalMod.create({ name: "Test", connectorId, scenarioIds: [scenarioId] });
      const updated = await evalMod.update(created.id, { scenarioIds: [scenario2Id] });

      expect(updated?.scenarioIds).toEqual([scenario2Id]);
    });

    it("updates eval to multiple scenarios", async () => {
      const created = await evalMod.create({ name: "Test", connectorId, scenarioIds: [scenarioId] });
      const updated = await evalMod.update(created.id, { scenarioIds: [scenarioId, scenario2Id] });

      expect(updated?.scenarioIds).toEqual([scenarioId, scenario2Id]);
    });

    it("returns undefined for non-existent id", async () => {
      const updated = await evalMod.update("non-existent", { connectorId });

      expect(updated).toBeUndefined();
    });

    it("throws error for non-existent scenario", async () => {
      const evalItem = await evalMod.create({ name: "Test", connectorId, scenarioIds: [scenarioId] });

      await expect(
        evalMod.update(evalItem.id, { scenarioIds: ["non-existent"] })
      ).rejects.toThrow('Scenario with id "non-existent" not found');
    });

    it("throws error for empty scenarioIds", async () => {
      const evalItem = await evalMod.create({ name: "Test", connectorId, scenarioIds: [scenarioId] });

      await expect(
        evalMod.update(evalItem.id, { scenarioIds: [] })
      ).rejects.toThrow("At least one scenario is required");
    });
  });

  describe("delete", () => {
    it("deletes existing eval", async () => {
      const created = await evalMod.create({ name: "Test", connectorId, scenarioIds: [scenarioId] });
      const deleted = await evalMod.delete(created.id);

      expect(deleted).toBe(true);
      expect(await evalMod.get(created.id)).toBeUndefined();
    });

    it("returns false for non-existent id", async () => {
      const deleted = await evalMod.delete("non-existent");

      expect(deleted).toBe(false);
    });
  });
});
