import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createProjectModules, type ScenarioModule } from "../index.js";
import { createFilesystemStorage } from "../filesystem-storage.js";
import type { StorageProvider } from "../storage-provider.js";

const projectId = "test-project-id";
let tempDir: string;
let storage: StorageProvider;
let mod: ScenarioModule;

describe("scenario", () => {
  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "evalstudio-test-"));
    mkdirSync(join(tempDir, "projects", projectId, "data"), { recursive: true });
    storage = createFilesystemStorage(tempDir);
    mod = createProjectModules(storage, projectId).scenarios;
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe("create", () => {
    it("creates a scenario with required fields", async () => {
      const scenario = await mod.create({ name: "Test Scenario" });

      expect(scenario.id).toBeDefined();
      expect(scenario.name).toBe("Test Scenario");
      expect(scenario.instructions).toBeUndefined();
      expect(scenario.createdAt).toBeDefined();
      expect(scenario.updatedAt).toBeDefined();
    });

    it("creates a scenario with all fields", async () => {
      const scenario = await mod.create({
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

    it("creates a scenario with failureCriteriaMode defaults to undefined", async () => {
      const scenario = await mod.create({
        name: "Default Mode Scenario",
        failureCriteria: "Agent provides wrong info",
      });

      expect(scenario.failureCriteriaMode).toBeUndefined();
    });

    it("creates a scenario with initial messages", async () => {
      const messages = [
        { role: "user" as const, content: "Hi, I need to cancel my appointment" },
        { role: "assistant" as const, content: "I'd be happy to help you cancel your appointment. Can you provide your booking reference?" },
        { role: "user" as const, content: "It's ABC123" },
      ];

      const scenario = await mod.create({
        name: "Mid-conversation Cancellation",
        instructions: "Continue the cancellation flow from this point",
        messages,
      });

      expect(scenario.messages).toEqual(messages);
      expect(scenario.messages).toHaveLength(3);
    });

    it("throws error for duplicate name", async () => {
      await mod.create({ name: "Test Scenario" });

      await expect(mod.create({ name: "Test Scenario" })).rejects.toThrow(
        'Scenario with name "Test Scenario" already exists'
      );
    });
  });

  describe("get", () => {
    it("returns scenario by id", async () => {
      const created = await mod.create({ name: "Test Scenario" });
      const found = await mod.get(created.id);

      expect(found).toEqual(created);
    });

    it("returns undefined for non-existent id", async () => {
      const found = await mod.get("non-existent");

      expect(found).toBeUndefined();
    });
  });

  describe("getByName", () => {
    it("returns scenario by name", async () => {
      const created = await mod.create({ name: "Test Scenario" });
      const found = await mod.getByName("Test Scenario");

      expect(found).toEqual(created);
    });

    it("returns undefined for non-existent name", async () => {
      const found = await mod.getByName("non-existent");

      expect(found).toBeUndefined();
    });
  });

  describe("list", () => {
    it("returns empty array when no scenarios", async () => {
      const scenarios = await mod.list();

      expect(scenarios).toEqual([]);
    });

    it("returns all scenarios", async () => {
      const scenario1 = await mod.create({ name: "Scenario 1" });
      const scenario2 = await mod.create({ name: "Scenario 2" });

      const scenarios = await mod.list();

      expect(scenarios).toHaveLength(2);
      expect(scenarios).toContainEqual(scenario1);
      expect(scenarios).toContainEqual(scenario2);
    });
  });

  describe("update", () => {
    it("updates scenario name", async () => {
      const created = await mod.create({ name: "Old Name" });
      await new Promise((resolve) => setTimeout(resolve, 10));
      const updated = await mod.update(created.id, { name: "New Name" });

      expect(updated?.name).toBe("New Name");
      expect(new Date(updated!.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(created.updatedAt).getTime()
      );
    });

    it("updates scenario instructions", async () => {
      const created = await mod.create({ name: "Test" });
      const updated = await mod.update(created.id, {
        instructions: "New instructions",
      });

      expect(updated?.instructions).toBe("New instructions");
    });

    it("updates scenario messages", async () => {
      const created = await mod.create({
        name: "Test",
        messages: [{ role: "user", content: "Hello" }],
      });

      const newMessages = [
        { role: "user" as const, content: "Hello" },
        { role: "assistant" as const, content: "Hi there!" },
        { role: "user" as const, content: "I need help" },
      ];

      const updated = await mod.update(created.id, { messages: newMessages });

      expect(updated?.messages).toEqual(newMessages);
      expect(updated?.messages).toHaveLength(3);
    });

    it("updates scenario maxMessages", async () => {
      const created = await mod.create({ name: "Test" });
      const updated = await mod.update(created.id, { maxMessages: 15 });

      expect(updated?.maxMessages).toBe(15);
    });

    it("updates scenario successCriteria", async () => {
      const created = await mod.create({ name: "Test" });
      const updated = await mod.update(created.id, { successCriteria: "New success criteria" });

      expect(updated?.successCriteria).toBe("New success criteria");
    });

    it("updates scenario failureCriteria", async () => {
      const created = await mod.create({ name: "Test" });
      const updated = await mod.update(created.id, { failureCriteria: "New failure criteria" });

      expect(updated?.failureCriteria).toBe("New failure criteria");
    });

    it("updates scenario failureCriteriaMode", async () => {
      const created = await mod.create({ name: "Test" });
      const updated = await mod.update(created.id, { failureCriteriaMode: "on_max_messages" });

      expect(updated?.failureCriteriaMode).toBe("on_max_messages");
    });

    it("updates scenario failureCriteriaMode to every_turn", async () => {
      const created = await mod.create({
        name: "Test",
        failureCriteriaMode: "on_max_messages",
      });
      const updated = await mod.update(created.id, { failureCriteriaMode: "every_turn" });

      expect(updated?.failureCriteriaMode).toBe("every_turn");
    });

    it("returns undefined for non-existent id", async () => {
      const updated = await mod.update("non-existent", { name: "new-name" });

      expect(updated).toBeUndefined();
    });

    it("throws error for duplicate name", async () => {
      await mod.create({ name: "Scenario 1" });
      const scenario2 = await mod.create({ name: "Scenario 2" });

      await expect(mod.update(scenario2.id, { name: "Scenario 1" })).rejects.toThrow(
        'Scenario with name "Scenario 1" already exists'
      );
    });
  });

  describe("delete", () => {
    it("deletes existing scenario", async () => {
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
