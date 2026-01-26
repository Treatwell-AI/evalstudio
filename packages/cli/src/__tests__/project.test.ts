import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { resetStorageDir, setStorageDir } from "evalstudio";

let testDir: string;

describe("project command", () => {
  beforeAll(() => {
    testDir = mkdtempSync(join(tmpdir(), "evalstudio-test-"));
    setStorageDir(testDir);
  });

  afterAll(() => {
    resetStorageDir();
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  beforeEach(() => {
    const storagePath = join(testDir, "projects.json");
    if (existsSync(storagePath)) {
      rmSync(storagePath);
    }
  });

  afterEach(() => {
    const storagePath = join(testDir, "projects.json");
    if (existsSync(storagePath)) {
      rmSync(storagePath);
    }
  });

  it("projectCommand is exported", async () => {
    const { projectCommand } = await import("../commands/project.js");
    expect(projectCommand).toBeDefined();
    expect(projectCommand.name()).toBe("project");
  });

  it("has create subcommand", async () => {
    const { projectCommand } = await import("../commands/project.js");
    const createCmd = projectCommand.commands.find((c) => c.name() === "create");
    expect(createCmd).toBeDefined();
    expect(createCmd?.description()).toBe("Create a new project");
  });

  it("has list subcommand", async () => {
    const { projectCommand } = await import("../commands/project.js");
    const listCmd = projectCommand.commands.find((c) => c.name() === "list");
    expect(listCmd).toBeDefined();
    expect(listCmd?.description()).toBe("List all projects");
  });

  it("has show subcommand", async () => {
    const { projectCommand } = await import("../commands/project.js");
    const showCmd = projectCommand.commands.find((c) => c.name() === "show");
    expect(showCmd).toBeDefined();
    expect(showCmd?.description()).toBe("Show project details");
  });

  it("has update subcommand", async () => {
    const { projectCommand } = await import("../commands/project.js");
    const updateCmd = projectCommand.commands.find((c) => c.name() === "update");
    expect(updateCmd).toBeDefined();
    expect(updateCmd?.description()).toBe("Update a project");
  });

  it("has delete subcommand", async () => {
    const { projectCommand } = await import("../commands/project.js");
    const deleteCmd = projectCommand.commands.find((c) => c.name() === "delete");
    expect(deleteCmd).toBeDefined();
    expect(deleteCmd?.description()).toBe("Delete a project");
  });
});
