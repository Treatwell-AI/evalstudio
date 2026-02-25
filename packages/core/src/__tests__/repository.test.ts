import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createJsonRepository } from "../repository.js";

let dataDir: string;

interface TestEntity {
  id: string;
  name: string;
  status?: string;
  groupId?: string;
}

interface NumericEntity {
  id: number;
  label: string;
}

describe("createJsonRepository", () => {
  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), "evalstudio-repo-test-"));
  });

  afterEach(() => {
    if (existsSync(dataDir)) {
      rmSync(dataDir, { recursive: true });
    }
  });

  // ── findAll / saveAll (existing tests) ────────────────────────────

  it("findAll returns empty array when file does not exist", async () => {
    const repo = createJsonRepository<TestEntity>("test-entities.json", dataDir);
    expect(await repo.findAll()).toEqual([]);
  });

  it("saveAll then findAll round-trips correctly", async () => {
    const repo = createJsonRepository<TestEntity>("test-entities.json", dataDir);
    const items: TestEntity[] = [
      { id: "1", name: "Alice" },
      { id: "2", name: "Bob" },
    ];

    await repo.saveAll(items);
    const loaded = await repo.findAll();

    expect(loaded).toEqual(items);
  });

  it("saveAll with empty array creates valid JSON", async () => {
    const repo = createJsonRepository<TestEntity>("test-entities.json", dataDir);

    await repo.saveAll([]);
    const loaded = await repo.findAll();

    expect(loaded).toEqual([]);
  });

  it("different dataDirs are independent", async () => {
    const altDir = mkdtempSync(join(tmpdir(), "evalstudio-repo-alt-"));

    const repoOriginal = createJsonRepository<TestEntity>("test-entities.json", dataDir);
    const repoAlt = createJsonRepository<TestEntity>("test-entities.json", altDir);

    await repoOriginal.saveAll([{ id: "1", name: "Original" }]);
    expect(await repoAlt.findAll()).toEqual([]);

    await repoAlt.saveAll([{ id: "2", name: "Alt" }]);
    expect(await repoAlt.findAll()).toEqual([{ id: "2", name: "Alt" }]);
    expect(await repoOriginal.findAll()).toEqual([{ id: "1", name: "Original" }]);

    rmSync(altDir, { recursive: true });
  });

  it("multiple repositories with different filenames are independent", async () => {
    const repoA = createJsonRepository<TestEntity>("entities-a.json", dataDir);
    const repoB = createJsonRepository<TestEntity>("entities-b.json", dataDir);

    await repoA.saveAll([{ id: "1", name: "A" }]);
    await repoB.saveAll([{ id: "2", name: "B" }]);

    expect(await repoA.findAll()).toEqual([{ id: "1", name: "A" }]);
    expect(await repoB.findAll()).toEqual([{ id: "2", name: "B" }]);
  });

  // ── findById ──────────────────────────────────────────────────────

  describe("findById", () => {
    it("returns the item when it exists", async () => {
      const repo = createJsonRepository<TestEntity>("test.json", dataDir);
      await repo.saveAll([
        { id: "a", name: "Alice" },
        { id: "b", name: "Bob" },
      ]);

      const found = await repo.findById("b");
      expect(found).toEqual({ id: "b", name: "Bob" });
    });

    it("returns undefined when id does not exist", async () => {
      const repo = createJsonRepository<TestEntity>("test.json", dataDir);
      await repo.saveAll([{ id: "a", name: "Alice" }]);

      expect(await repo.findById("missing")).toBeUndefined();
    });

    it("returns undefined on empty collection", async () => {
      const repo = createJsonRepository<TestEntity>("test.json", dataDir);

      expect(await repo.findById("any")).toBeUndefined();
    });

    it("works with numeric ids", async () => {
      const repo = createJsonRepository<NumericEntity>("nums.json", dataDir);
      await repo.saveAll([
        { id: 1, label: "one" },
        { id: 2, label: "two" },
      ]);

      expect(await repo.findById(2)).toEqual({ id: 2, label: "two" });
      expect(await repo.findById(99)).toBeUndefined();
    });
  });

  // ── findBy ────────────────────────────────────────────────────────

  describe("findBy", () => {
    it("filters by a single field", async () => {
      const repo = createJsonRepository<TestEntity>("test.json", dataDir);
      await repo.saveAll([
        { id: "1", name: "Alice", status: "active" },
        { id: "2", name: "Bob", status: "inactive" },
        { id: "3", name: "Carol", status: "active" },
      ]);

      const active = await repo.findBy({ status: "active" });
      expect(active).toHaveLength(2);
      expect(active.map((e) => e.name)).toEqual(["Alice", "Carol"]);
    });

    it("filters by multiple fields (AND logic)", async () => {
      const repo = createJsonRepository<TestEntity>("test.json", dataDir);
      await repo.saveAll([
        { id: "1", name: "Alice", status: "active", groupId: "g1" },
        { id: "2", name: "Bob", status: "active", groupId: "g2" },
        { id: "3", name: "Carol", status: "inactive", groupId: "g1" },
      ]);

      const result = await repo.findBy({ status: "active", groupId: "g1" });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Alice");
    });

    it("returns empty array when nothing matches", async () => {
      const repo = createJsonRepository<TestEntity>("test.json", dataDir);
      await repo.saveAll([{ id: "1", name: "Alice", status: "active" }]);

      expect(await repo.findBy({ status: "missing" })).toEqual([]);
    });

    it("returns empty array on empty collection", async () => {
      const repo = createJsonRepository<TestEntity>("test.json", dataDir);

      expect(await repo.findBy({ name: "anything" })).toEqual([]);
    });
  });

  // ── save (upsert single item) ─────────────────────────────────────

  describe("save", () => {
    it("inserts a new item into empty collection", async () => {
      const repo = createJsonRepository<TestEntity>("test.json", dataDir);

      await repo.save({ id: "a", name: "Alice" });

      expect(await repo.findAll()).toEqual([{ id: "a", name: "Alice" }]);
    });

    it("inserts a new item alongside existing items", async () => {
      const repo = createJsonRepository<TestEntity>("test.json", dataDir);
      await repo.saveAll([{ id: "a", name: "Alice" }]);

      await repo.save({ id: "b", name: "Bob" });

      const all = await repo.findAll();
      expect(all).toHaveLength(2);
      expect(all).toContainEqual({ id: "a", name: "Alice" });
      expect(all).toContainEqual({ id: "b", name: "Bob" });
    });

    it("updates an existing item (upsert)", async () => {
      const repo = createJsonRepository<TestEntity>("test.json", dataDir);
      await repo.saveAll([
        { id: "a", name: "Alice" },
        { id: "b", name: "Bob" },
      ]);

      await repo.save({ id: "a", name: "Alice Updated" });

      const all = await repo.findAll();
      expect(all).toHaveLength(2);
      expect(all).toContainEqual({ id: "a", name: "Alice Updated" });
      expect(all).toContainEqual({ id: "b", name: "Bob" });
    });

    it("does not delete other items (unlike saveAll)", async () => {
      const repo = createJsonRepository<TestEntity>("test.json", dataDir);
      await repo.saveAll([
        { id: "a", name: "Alice" },
        { id: "b", name: "Bob" },
        { id: "c", name: "Carol" },
      ]);

      await repo.save({ id: "b", name: "Bob Updated" });

      expect(await repo.findAll()).toHaveLength(3);
    });
  });

  // ── saveMany (batch upsert) ───────────────────────────────────────

  describe("saveMany", () => {
    it("inserts multiple new items", async () => {
      const repo = createJsonRepository<TestEntity>("test.json", dataDir);

      await repo.saveMany([
        { id: "a", name: "Alice" },
        { id: "b", name: "Bob" },
      ]);

      expect(await repo.findAll()).toHaveLength(2);
    });

    it("inserts new items alongside existing ones", async () => {
      const repo = createJsonRepository<TestEntity>("test.json", dataDir);
      await repo.saveAll([{ id: "a", name: "Alice" }]);

      await repo.saveMany([
        { id: "b", name: "Bob" },
        { id: "c", name: "Carol" },
      ]);

      expect(await repo.findAll()).toHaveLength(3);
    });

    it("upserts: updates existing and inserts new", async () => {
      const repo = createJsonRepository<TestEntity>("test.json", dataDir);
      await repo.saveAll([
        { id: "a", name: "Alice" },
        { id: "b", name: "Bob" },
      ]);

      await repo.saveMany([
        { id: "a", name: "Alice Updated" },
        { id: "c", name: "Carol" },
      ]);

      const all = await repo.findAll();
      expect(all).toHaveLength(3);
      expect(all).toContainEqual({ id: "a", name: "Alice Updated" });
      expect(all).toContainEqual({ id: "b", name: "Bob" });
      expect(all).toContainEqual({ id: "c", name: "Carol" });
    });

    it("does nothing with empty array", async () => {
      const repo = createJsonRepository<TestEntity>("test.json", dataDir);
      await repo.saveAll([{ id: "a", name: "Alice" }]);

      await repo.saveMany([]);

      expect(await repo.findAll()).toEqual([{ id: "a", name: "Alice" }]);
    });

    it("does not delete items not in the batch (unlike saveAll)", async () => {
      const repo = createJsonRepository<TestEntity>("test.json", dataDir);
      await repo.saveAll([
        { id: "a", name: "Alice" },
        { id: "b", name: "Bob" },
      ]);

      // saveMany with only "a" should NOT delete "b"
      await repo.saveMany([{ id: "a", name: "Alice Updated" }]);

      expect(await repo.findAll()).toHaveLength(2);
      expect(await repo.findById("b")).toEqual({ id: "b", name: "Bob" });
    });
  });

  // ── deleteById ────────────────────────────────────────────────────

  describe("deleteById", () => {
    it("deletes an existing item and returns true", async () => {
      const repo = createJsonRepository<TestEntity>("test.json", dataDir);
      await repo.saveAll([
        { id: "a", name: "Alice" },
        { id: "b", name: "Bob" },
      ]);

      const result = await repo.deleteById("a");

      expect(result).toBe(true);
      expect(await repo.findAll()).toEqual([{ id: "b", name: "Bob" }]);
    });

    it("returns false when id does not exist", async () => {
      const repo = createJsonRepository<TestEntity>("test.json", dataDir);
      await repo.saveAll([{ id: "a", name: "Alice" }]);

      expect(await repo.deleteById("missing")).toBe(false);
      expect(await repo.findAll()).toHaveLength(1);
    });

    it("returns false on empty collection", async () => {
      const repo = createJsonRepository<TestEntity>("test.json", dataDir);

      expect(await repo.deleteById("any")).toBe(false);
    });

    it("works with numeric ids", async () => {
      const repo = createJsonRepository<NumericEntity>("nums.json", dataDir);
      await repo.saveAll([
        { id: 1, label: "one" },
        { id: 2, label: "two" },
      ]);

      expect(await repo.deleteById(1)).toBe(true);
      expect(await repo.findAll()).toEqual([{ id: 2, label: "two" }]);
    });
  });

  // ── maxId ─────────────────────────────────────────────────────────

  describe("maxId", () => {
    it("returns 0 on empty collection", async () => {
      const repo = createJsonRepository<NumericEntity>("nums.json", dataDir);

      expect(await repo.maxId()).toBe(0);
    });

    it("returns the highest numeric id", async () => {
      const repo = createJsonRepository<NumericEntity>("nums.json", dataDir);
      await repo.saveAll([
        { id: 3, label: "three" },
        { id: 1, label: "one" },
        { id: 7, label: "seven" },
        { id: 5, label: "five" },
      ]);

      expect(await repo.maxId()).toBe(7);
    });

    it("works after save adds a new item", async () => {
      const repo = createJsonRepository<NumericEntity>("nums.json", dataDir);
      await repo.saveAll([{ id: 1, label: "one" }]);

      await repo.save({ id: 10, label: "ten" });

      expect(await repo.maxId()).toBe(10);
    });
  });

  // ── Integration: targeted ops compose correctly ───────────────────

  describe("integration", () => {
    it("save then findById round-trips", async () => {
      const repo = createJsonRepository<TestEntity>("test.json", dataDir);

      await repo.save({ id: "x", name: "Xavier", status: "active" });
      const found = await repo.findById("x");

      expect(found).toEqual({ id: "x", name: "Xavier", status: "active" });
    });

    it("saveMany then findBy filters correctly", async () => {
      const repo = createJsonRepository<TestEntity>("test.json", dataDir);

      await repo.saveMany([
        { id: "1", name: "A", status: "queued" },
        { id: "2", name: "B", status: "running" },
        { id: "3", name: "C", status: "queued" },
      ]);

      const queued = await repo.findBy({ status: "queued" });
      expect(queued).toHaveLength(2);
    });

    it("deleteById then findById returns undefined", async () => {
      const repo = createJsonRepository<TestEntity>("test.json", dataDir);

      await repo.save({ id: "z", name: "Zara" });
      expect(await repo.findById("z")).toBeDefined();

      await repo.deleteById("z");
      expect(await repo.findById("z")).toBeUndefined();
    });

    it("save updates only the targeted item", async () => {
      const repo = createJsonRepository<TestEntity>("test.json", dataDir);

      await repo.saveMany([
        { id: "1", name: "Original-1", status: "queued" },
        { id: "2", name: "Original-2", status: "queued" },
        { id: "3", name: "Original-3", status: "queued" },
      ]);

      // Update only item 2
      await repo.save({ id: "2", name: "Updated-2", status: "running" });

      // Items 1 and 3 should be untouched
      expect(await repo.findById("1")).toEqual({ id: "1", name: "Original-1", status: "queued" });
      expect(await repo.findById("2")).toEqual({ id: "2", name: "Updated-2", status: "running" });
      expect(await repo.findById("3")).toEqual({ id: "3", name: "Original-3", status: "queued" });
    });
  });
});
