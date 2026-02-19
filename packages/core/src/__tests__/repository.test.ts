import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createJsonRepository } from "../repository.js";

let dataDir: string;

interface TestEntity {
  id: string;
  name: string;
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

    // Save in original dir
    await repoOriginal.saveAll([{ id: "1", name: "Original" }]);

    // Alt dir should be empty
    expect(await repoAlt.findAll()).toEqual([]);

    // Save in alt dir
    await repoAlt.saveAll([{ id: "2", name: "Alt" }]);
    expect(await repoAlt.findAll()).toEqual([{ id: "2", name: "Alt" }]);

    // Original should still have its data
    expect(await repoOriginal.findAll()).toEqual([{ id: "1", name: "Original" }]);

    // Cleanup alt dir
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
});
