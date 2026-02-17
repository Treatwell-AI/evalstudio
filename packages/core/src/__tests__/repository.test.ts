import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createJsonRepository } from "../repository.js";
import { resetStorageDir, setStorageDir } from "../storage.js";

let testDir: string;

interface TestEntity {
  id: string;
  name: string;
}

describe("createJsonRepository", () => {
  beforeAll(() => {
    testDir = mkdtempSync(join(tmpdir(), "evalstudio-repo-test-"));
    setStorageDir(testDir);
  });

  afterAll(() => {
    resetStorageDir();
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  beforeEach(() => {
    const path = join(testDir, "test-entities.json");
    if (existsSync(path)) {
      rmSync(path);
    }
  });

  it("findAll returns empty array when file does not exist", () => {
    const repo = createJsonRepository<TestEntity>("test-entities.json");
    expect(repo.findAll()).toEqual([]);
  });

  it("saveAll then findAll round-trips correctly", () => {
    const repo = createJsonRepository<TestEntity>("test-entities.json");
    const items: TestEntity[] = [
      { id: "1", name: "Alice" },
      { id: "2", name: "Bob" },
    ];

    repo.saveAll(items);
    const loaded = repo.findAll();

    expect(loaded).toEqual(items);
  });

  it("saveAll with empty array creates valid JSON", () => {
    const repo = createJsonRepository<TestEntity>("test-entities.json");

    repo.saveAll([]);
    const loaded = repo.findAll();

    expect(loaded).toEqual([]);
  });

  it("respects setStorageDir override", () => {
    const altDir = mkdtempSync(join(tmpdir(), "evalstudio-repo-alt-"));
    const repo = createJsonRepository<TestEntity>("test-entities.json");

    // Save in original dir
    repo.saveAll([{ id: "1", name: "Original" }]);

    // Switch dir and verify empty
    setStorageDir(altDir);
    expect(repo.findAll()).toEqual([]);

    // Save in alt dir
    repo.saveAll([{ id: "2", name: "Alt" }]);
    expect(repo.findAll()).toEqual([{ id: "2", name: "Alt" }]);

    // Switch back and verify original data
    setStorageDir(testDir);
    expect(repo.findAll()).toEqual([{ id: "1", name: "Original" }]);

    // Cleanup alt dir
    rmSync(altDir, { recursive: true });
  });

  it("multiple repositories with different filenames are independent", () => {
    const repoA = createJsonRepository<TestEntity>("entities-a.json");
    const repoB = createJsonRepository<TestEntity>("entities-b.json");

    repoA.saveAll([{ id: "1", name: "A" }]);
    repoB.saveAll([{ id: "2", name: "B" }]);

    expect(repoA.findAll()).toEqual([{ id: "1", name: "A" }]);
    expect(repoB.findAll()).toEqual([{ id: "2", name: "B" }]);

    // Cleanup extra file
    const pathB = join(testDir, "entities-b.json");
    if (existsSync(pathB)) rmSync(pathB);
    const pathA = join(testDir, "entities-a.json");
    if (existsSync(pathA)) rmSync(pathA);
  });
});
