import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createConnector } from "../connector.js";
import { createEval } from "../eval.js";
import { createPersona } from "../persona.js";
import { createRun, getRun, listRuns, updateRun } from "../run.js";
import { RunProcessor } from "../run-processor.js";
import { createScenario } from "../scenario.js";
import { resetStorageDir, setConfigDir, setStorageDir } from "../project-resolver.js";

// Mock the evaluator to return success on first evaluation
vi.mock("../evaluator.js", () => ({
  evaluateCriteria: vi.fn().mockResolvedValue({
    successMet: true,
    failureMet: false,
    confidence: 1.0,
    reasoning: "Test passed",
  }),
}));

let testDir: string;

describe("RunProcessor", () => {
  let scenarioId: string;
  let evalId: string;
  let connectorId: string;

  const mockFetch = vi.fn();

  beforeAll(() => {
    testDir = mkdtempSync(join(tmpdir(), "evalstudio-processor-test-"));
    setStorageDir(testDir);
    setConfigDir(testDir);

    // Write project config with inline LLM provider
    writeFileSync(
      join(testDir, "evalstudio.config.json"),
      JSON.stringify({
        version: 2,
        name: "processor-test",
        llmProvider: {
          provider: "openai",
          apiKey: "test-api-key",
        },
      }, null, 2)
    );

    createPersona({
      name: "Test Persona",
      description: "A test persona",
      systemPrompt: "You are a helpful test user.",
    });

    const scenario = createScenario({
      name: "Test Scenario",
      instructions: "Test the greeting feature",
      successCriteria: "The agent responds with a greeting",
    });
    scenarioId = scenario.id;

    const connector = createConnector({
      name: "Test Connector",
      type: "http",
      baseUrl: "https://api.example.com",
    });
    connectorId = connector.id;

    const evalItem = createEval({
      name: "Test Eval",
      connectorId,
      scenarioIds: [scenarioId],
      input: [{ role: "user", content: "Hello" }],
    });
    evalId = evalItem.id;
  });

  afterAll(() => {
    resetStorageDir();
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    // Clear runs before each test
    const runsPath = join(testDir, "runs.json");
    if (existsSync(runsPath)) {
      rmSync(runsPath);
    }
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    mockFetch.mockReset();
  });

  describe("constructor", () => {
    it("creates processor with default options", () => {
      const processor = new RunProcessor();
      expect(processor.isRunning()).toBe(false);
      expect(processor.getActiveRunCount()).toBe(0);
    });

    it("creates processor with custom options", () => {
      const processor = new RunProcessor({
        pollIntervalMs: 1000,
        maxConcurrent: 5,
      });
      expect(processor.isRunning()).toBe(false);
    });

    it("reads maxConcurrency from project config when not provided", () => {
      // Write config with maxConcurrency
      writeFileSync(
        join(testDir, "evalstudio.config.json"),
        JSON.stringify({
          version: 2,
          name: "processor-test",
          llmProvider: { provider: "openai", apiKey: "test-api-key" },
          maxConcurrency: 7,
        }, null, 2)
      );

      // Create 8 queued runs
      for (let i = 0; i < 8; i++) {
        createRun({ evalId });
      }

      mockFetch.mockImplementation(async () => ({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            message: { role: "assistant", content: "Done" },
          }),
      }));

      // Processor should read maxConcurrency=7 from config
      const processor = new RunProcessor();
      return processor.processOnce().then((started) => {
        expect(started).toBe(7);

        // Restore config
        writeFileSync(
          join(testDir, "evalstudio.config.json"),
          JSON.stringify({
            version: 2,
            name: "processor-test",
            llmProvider: { provider: "openai", apiKey: "test-api-key" },
          }, null, 2)
        );
      });
    });

    it("uses explicit maxConcurrent over project config", () => {
      // Write config with maxConcurrency=10
      writeFileSync(
        join(testDir, "evalstudio.config.json"),
        JSON.stringify({
          version: 2,
          name: "processor-test",
          llmProvider: { provider: "openai", apiKey: "test-api-key" },
          maxConcurrency: 10,
        }, null, 2)
      );

      // Create 5 queued runs
      for (let i = 0; i < 5; i++) {
        createRun({ evalId });
      }

      mockFetch.mockImplementation(async () => ({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            message: { role: "assistant", content: "Done" },
          }),
      }));

      // Explicit maxConcurrent=2 should override config's 10
      const processor = new RunProcessor({ maxConcurrent: 2 });
      return processor.processOnce().then((started) => {
        expect(started).toBe(2);

        // Restore config
        writeFileSync(
          join(testDir, "evalstudio.config.json"),
          JSON.stringify({
            version: 2,
            name: "processor-test",
            llmProvider: { provider: "openai", apiKey: "test-api-key" },
          }, null, 2)
        );
      });
    });
  });

  describe("start/stop", () => {
    it("starts and stops the processor", async () => {
      const processor = new RunProcessor({ pollIntervalMs: 100 });

      processor.start();
      expect(processor.isRunning()).toBe(true);

      await processor.stop();
      expect(processor.isRunning()).toBe(false);
    });

    it("does not start twice", () => {
      const processor = new RunProcessor({ pollIntervalMs: 100 });

      processor.start();
      processor.start(); // Should be a no-op

      expect(processor.isRunning()).toBe(true);

      processor.stop();
    });
  });

  describe("processOnce", () => {
    it("processes queued runs", async () => {
      const run = createRun({
        evalId,
        connectorId,
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            message: { role: "assistant", content: "Hello there!" },
          }),
      });

      const processor = new RunProcessor();
      const started = await processor.processOnce();

      expect(started).toBe(1);

      // processOnce waits for completion, so run should be done
      const updatedRun = getRun(run.id);
      expect(updatedRun?.status).toBe("completed");
      // Messages include: system prompt, user input, assistant response
      expect(updatedRun?.messages).toHaveLength(3);
      expect(updatedRun?.messages[0].role).toBe("system");
      expect(updatedRun?.messages[1].role).toBe("user");
      expect(updatedRun?.messages[1].content).toBe("Hello");
      expect(updatedRun?.messages[2].role).toBe("assistant");
      expect(updatedRun?.messages[2].content).toBe("Hello there!");
    });

    it("respects maxConcurrent limit", async () => {
      // Create multiple queued runs
      createRun({ evalId });
      createRun({ evalId });
      createRun({ evalId });

      mockFetch.mockImplementation(async () => {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              message: { role: "assistant", content: "Done" },
            }),
        };
      });

      const processor = new RunProcessor({ maxConcurrent: 2 });
      const started = await processor.processOnce();

      // Should only start 2 due to maxConcurrent (processOnce processes one batch)
      expect(started).toBe(2);
    });
  });

  describe("callbacks", () => {
    it("calls onRunStart callback", async () => {
      const onRunStart = vi.fn();
      createRun({ evalId });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            message: { role: "assistant", content: "Hi" },
          }),
      });

      const processor = new RunProcessor({ onRunStart });
      await processor.processOnce();

      expect(onRunStart).toHaveBeenCalledTimes(1);
      expect(onRunStart).toHaveBeenCalledWith(expect.objectContaining({ evalId }));
    });

    it("calls onRunComplete callback on success", async () => {
      const onRunComplete = vi.fn();
      createRun({ evalId });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            message: { role: "assistant", content: "Hi" },
          }),
      });

      const processor = new RunProcessor({ onRunComplete });
      await processor.processOnce();

      expect(onRunComplete).toHaveBeenCalledTimes(1);
      expect(onRunComplete).toHaveBeenCalledWith(
        expect.objectContaining({ status: "completed" }),
        expect.objectContaining({ success: true })
      );
    });

    it("calls onRunError callback on failure", async () => {
      const onRunError = vi.fn();
      createRun({ evalId });

      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const processor = new RunProcessor({ onRunError });
      await processor.processOnce();

      expect(onRunError).toHaveBeenCalledTimes(1);
      expect(onRunError).toHaveBeenCalledWith(
        expect.objectContaining({ status: "error" }),
        expect.any(Error)
      );
    });

    it("calls onStatusChange callback", async () => {
      const onStatusChange = vi.fn();
      createRun({ evalId });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            message: { role: "assistant", content: "Hi" },
          }),
      });

      const processor = new RunProcessor({ onStatusChange });
      await processor.processOnce();

      expect(onStatusChange).toHaveBeenCalledTimes(2); // running + completed
      expect(onStatusChange).toHaveBeenNthCalledWith(
        1,
        expect.any(String),
        "running",
        expect.any(Object)
      );
      expect(onStatusChange).toHaveBeenNthCalledWith(
        2,
        expect.any(String),
        "completed",
        expect.any(Object)
      );
    });
  });

  describe("error handling", () => {
    it("marks run as error when connector invocation fails", async () => {
      const run = createRun({ evalId });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => "Internal Server Error",
      });

      const processor = new RunProcessor();
      await processor.processOnce();

      const updatedRun = getRun(run.id);
      expect(updatedRun?.status).toBe("error");
      expect(updatedRun?.error).toContain("500");
    });

    it("processes run successfully when eval exists", async () => {
      const run = createRun({ evalId });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            message: { role: "assistant", content: "Hi" },
          }),
      });

      const processor = new RunProcessor();
      await processor.processOnce();

      // Run should be completed since eval exists
      const updatedRun = getRun(run.id);
      expect(updatedRun?.status).toBe("completed");
    });
  });

  describe("atomic claiming", () => {
    it("prevents duplicate processing of the same run", async () => {
      const run = createRun({ evalId });

      // Manually set status to running (simulating another processor claimed it)
      updateRun(run.id, { status: "running" });

      const processor = new RunProcessor();
      const started = await processor.processOnce();

      // Should not claim the already-running run
      expect(started).toBe(0);
    });
  });

  describe("crash recovery", () => {
    it("resets running runs to queued on start", async () => {
      // Create a run and set it to "running" (simulating crash)
      const run = createRun({ evalId });
      updateRun(run.id, { status: "running" });

      // Use maxConcurrent: 0 to prevent tick() from claiming the run
      // This allows us to verify recovery happened before processing
      const processor = new RunProcessor({ maxConcurrent: 0 });
      processor.start();

      // Check that run was reset to queued
      const resetRun = getRun(run.id);
      expect(resetRun?.status).toBe("queued");

      await processor.stop();
    });
  });

  describe("seed flow routing", () => {
    it("invokes connector when last seed message is from user", async () => {
      const run = createRun({ evalId });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            message: { role: "assistant", content: "Hello there!" },
          }),
      });

      const processor = new RunProcessor();
      await processor.processOnce();

      // Connector should have been called
      expect(mockFetch).toHaveBeenCalled();

      const updatedRun = getRun(run.id);
      expect(updatedRun?.status).toBe("completed");
      expect(updatedRun?.messages.some((m) => m.role === "assistant")).toBe(true);
    });
  });
});

describe("listRuns with options", () => {
  let testDir: string;
  let evalId: string;
  let connectorId: string;
  let scenarioId: string;

  beforeAll(() => {
    testDir = mkdtempSync(join(tmpdir(), "evalstudio-listruns-test-"));
    setStorageDir(testDir);

    const scenario = createScenario({
      name: "List Test Scenario",
    });
    scenarioId = scenario.id;

    const connector = createConnector({
      name: "List Test Connector",
      type: "http",
      baseUrl: "https://api.example.com",
    });
    connectorId = connector.id;

    const evalItem = createEval({
      name: "List Test Eval",
      connectorId,
      scenarioIds: [scenarioId],
      input: [],
    });
    evalId = evalItem.id;
  });

  afterAll(() => {
    resetStorageDir();
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  beforeEach(() => {
    const runsPath = join(testDir, "runs.json");
    if (existsSync(runsPath)) {
      rmSync(runsPath);
    }
  });

  it("filters by status", () => {
    const run1 = createRun({ evalId });
    const run2 = createRun({ evalId });
    updateRun(run1.id, { status: "running" });

    const queued = listRuns({ status: "queued" });
    const running = listRuns({ status: "running" });

    expect(queued).toHaveLength(1);
    expect(queued[0].id).toBe(run2.id);
    expect(running).toHaveLength(1);
    expect(running[0].id).toBe(run1.id);
  });

  it("applies limit", () => {
    createRun({ evalId });
    createRun({ evalId });
    createRun({ evalId });

    const limited = listRuns({ limit: 2 });

    expect(limited).toHaveLength(2);
  });

  it("combines multiple filters", () => {
    createRun({ evalId });
    const run2 = createRun({ evalId });
    createRun({ evalId });
    updateRun(run2.id, { status: "running" });

    const result = listRuns({ status: "queued", limit: 1 });

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("queued");
  });
});
