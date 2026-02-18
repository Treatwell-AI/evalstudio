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

  it("findAll returns empty array when file does not exist", () => {
    const repo = createJsonRepository<TestEntity>("test-entities.json", dataDir);
    expect(repo.findAll()).toEqual([]);
  });

  it("saveAll then findAll round-trips correctly", () => {
    const repo = createJsonRepository<TestEntity>("test-entities.json", dataDir);
    const items: TestEntity[] = [
      { id: "1", name: "Alice" },
      { id: "2", name: "Bob" },
    ];

    repo.saveAll(items);
    const loaded = repo.findAll();

    expect(loaded).toEqual(items);
  });

  it("saveAll with empty array creates valid JSON", () => {
    const repo = createJsonRepository<TestEntity>("test-entities.json", dataDir);

    repo.saveAll([]);
    const loaded = repo.findAll();

    expect(loaded).toEqual([]);
  });

  it("different dataDirs are independent", () => {
    const altDir = mkdtempSync(join(tmpdir(), "evalstudio-repo-alt-"));

    const repoOriginal = createJsonRepository<TestEntity>("test-entities.json", dataDir);
    const repoAlt = createJsonRepository<TestEntity>("test-entities.json", altDir);

    // Save in original dir
    repoOriginal.saveAll([{ id: "1", name: "Original" }]);

    // Alt dir should be empty
    expect(repoAlt.findAll()).toEqual([]);

    // Save in alt dir
    repoAlt.saveAll([{ id: "2", name: "Alt" }]);
    expect(repoAlt.findAll()).toEqual([{ id: "2", name: "Alt" }]);

    // Original should still have its data
    expect(repoOriginal.findAll()).toEqual([{ id: "1", name: "Original" }]);

    // Cleanup alt dir
    rmSync(altDir, { recursive: true });
  });

  it("multiple repositories with different filenames are independent", () => {
    const repoA = createJsonRepository<TestEntity>("entities-a.json", dataDir);
    const repoB = createJsonRepository<TestEntity>("entities-b.json", dataDir);

    repoA.saveAll([{ id: "1", name: "A" }]);
    repoB.saveAll([{ id: "2", name: "B" }]);

    expect(repoA.findAll()).toEqual([{ id: "1", name: "A" }]);
    expect(repoB.findAll()).toEqual([{ id: "2", name: "B" }]);
  });
});
