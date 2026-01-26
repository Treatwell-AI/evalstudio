import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { resetStorageDir, setStorageDir } from "evalstudio";

let testDir: string;

describe("eval command", () => {
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

  afterEach(() => {
    const storagePath = join(testDir, "evals.json");
    if (existsSync(storagePath)) {
      rmSync(storagePath);
    }
  });

  it("evalCommand is exported", async () => {
    const { evalCommand } = await import("../commands/eval.js");
    expect(evalCommand).toBeDefined();
    expect(evalCommand.name()).toBe("eval");
  });

  it("has create subcommand", async () => {
    const { evalCommand } = await import("../commands/eval.js");
    const createCmd = evalCommand.commands.find((c) => c.name() === "create");
    expect(createCmd).toBeDefined();
    expect(createCmd?.description()).toBe("Create a new eval");
  });

  it("has list subcommand", async () => {
    const { evalCommand } = await import("../commands/eval.js");
    const listCmd = evalCommand.commands.find((c) => c.name() === "list");
    expect(listCmd).toBeDefined();
    expect(listCmd?.description()).toBe("List evals");
  });

  it("has show subcommand", async () => {
    const { evalCommand } = await import("../commands/eval.js");
    const showCmd = evalCommand.commands.find((c) => c.name() === "show");
    expect(showCmd).toBeDefined();
    expect(showCmd?.description()).toBe("Show eval details");
  });

  it("has update subcommand", async () => {
    const { evalCommand } = await import("../commands/eval.js");
    const updateCmd = evalCommand.commands.find((c) => c.name() === "update");
    expect(updateCmd).toBeDefined();
    expect(updateCmd?.description()).toBe("Update an eval");
  });

  it("has delete subcommand", async () => {
    const { evalCommand } = await import("../commands/eval.js");
    const deleteCmd = evalCommand.commands.find((c) => c.name() === "delete");
    expect(deleteCmd).toBeDefined();
    expect(deleteCmd?.description()).toBe("Delete an eval");
  });

  it("create command has required project option", async () => {
    const { evalCommand } = await import("../commands/eval.js");
    const createCmd = evalCommand.commands.find((c) => c.name() === "create");
    const projectOpt = createCmd?.options.find((o) => o.long === "--project");
    expect(projectOpt).toBeDefined();
    expect(projectOpt?.required).toBe(true);
  });

  it("create command has required scenario option", async () => {
    const { evalCommand } = await import("../commands/eval.js");
    const createCmd = evalCommand.commands.find((c) => c.name() === "create");
    const scenarioOpt = createCmd?.options.find((o) => o.long === "--scenario");
    expect(scenarioOpt).toBeDefined();
    expect(scenarioOpt?.required).toBe(true);
  });

  it("show command has expand option", async () => {
    const { evalCommand } = await import("../commands/eval.js");
    const showCmd = evalCommand.commands.find((c) => c.name() === "show");
    const expandOpt = showCmd?.options.find((o) => o.long === "--expand");
    expect(expandOpt).toBeDefined();
  });
});
