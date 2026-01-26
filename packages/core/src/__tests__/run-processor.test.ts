import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createConnector } from "../connector.js";
import { createEval } from "../eval.js";
import { createLLMProvider } from "../llm-provider.js";
import { createPersona } from "../persona.js";
import { createProject, updateProject } from "../project.js";
import { createRun, getRun, listRuns, updateRun } from "../run.js";
import { RunProcessor } from "../run-processor.js";
import { createScenario } from "../scenario.js";
import { resetStorageDir, setStorageDir } from "../storage.js";

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
  let projectId: string;
  let scenarioId: string;
  let evalId: string;
  let connectorId: string;
  let llmProviderId: string;

  const mockFetch = vi.fn();

  beforeAll(() => {
    testDir = mkdtempSync(join(tmpdir(), "evalstudio-processor-test-"));
    setStorageDir(testDir);

    // Create test fixtures
    const project = createProject({ name: `processor-test-${Date.now()}` });
    projectId = project.id;

    createPersona({
      projectId,
      name: "Test Persona",
      description: "A test persona",
      systemPrompt: "You are a helpful test user.",
    });

    const scenario = createScenario({
      projectId,
      name: "Test Scenario",
      instructions: "Test the greeting feature",
      successCriteria: "The agent responds with a greeting",
    });
    scenarioId = scenario.id;

    // Create connector BEFORE eval (connector is now required for evals)
    const connector = createConnector({
      projectId,
      name: "Test Connector",
      type: "http",
      baseUrl: "https://api.example.com",
    });
    connectorId = connector.id;

    // Create LLM provider (required for evaluation)
    const llmProvider = createLLMProvider({
      projectId,
      name: "Test LLM Provider",
      provider: "openai",
      apiKey: "test-api-key",
    });
    llmProviderId = llmProvider.id;

    // Configure project LLM settings (required for run processing)
    updateProject(projectId, {
      llmSettings: {
        evaluation: { providerId: llmProviderId },
      },
    });

    const evalItem = createEval({
      projectId,
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
        projectId: "test-project",
      });
      expect(processor.isRunning()).toBe(false);
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

    it("filters by projectId when specified", async () => {
      // Create run for a different project
      const otherProject = createProject({ name: `other-project-${Date.now()}` });
      const otherConnector = createConnector({
        projectId: otherProject.id,
        name: "Other Connector",
        type: "http",
        baseUrl: "https://other.api.com",
      });
      const otherScenario = createScenario({
        projectId: otherProject.id,
        name: "Other Scenario",
      });
      const otherEval = createEval({
        projectId: otherProject.id,
        name: "Other Eval",
        connectorId: otherConnector.id,
        scenarioIds: [otherScenario.id],
        input: [],
      });

      createRun({ evalId: otherEval.id });
      createRun({ evalId }); // Our project's run

      const processor = new RunProcessor({ projectId });
      const started = await processor.processOnce();

      // Should only process the run from our project
      expect(started).toBe(1);

      await processor.stop();
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

    // Note: "marks run as failed when connector is missing" test was removed
    // because connector is now required at eval creation time.

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
      // Default test setup has eval with input: [{ role: "user", content: "Hello" }]
      // This is the standard case - connector should be invoked
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
  let projectId: string;
  let evalId: string;
  let connectorId: string;
  let scenarioId: string;

  beforeAll(() => {
    testDir = mkdtempSync(join(tmpdir(), "evalstudio-listruns-test-"));
    setStorageDir(testDir);

    const project = createProject({ name: `list-runs-test-${Date.now()}` });
    projectId = project.id;

    const scenario = createScenario({
      projectId,
      name: "List Test Scenario",
    });
    scenarioId = scenario.id;

    // Create connector BEFORE eval (connector is now required for evals)
    const connector = createConnector({
      projectId,
      name: "List Test Connector",
      type: "http",
      baseUrl: "https://api.example.com",
    });
    connectorId = connector.id;

    const evalItem = createEval({
      projectId,
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

  it("filters by projectId", () => {
    const otherProject = createProject({ name: `other-${Date.now()}` });
    const otherConnector = createConnector({
      projectId: otherProject.id,
      name: "Other",
      type: "http",
      baseUrl: "https://other.api.com",
    });
    const otherScenario = createScenario({
      projectId: otherProject.id,
      name: "Other Scenario",
    });
    const otherEval = createEval({
      projectId: otherProject.id,
      name: "Other Project Eval",
      connectorId: otherConnector.id,
      scenarioIds: [otherScenario.id],
      input: [],
    });

    createRun({ evalId });
    createRun({ evalId: otherEval.id });

    const projectRuns = listRuns({ projectId });

    expect(projectRuns).toHaveLength(1);
    expect(projectRuns[0].projectId).toBe(projectId);
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

  it("maintains backward compatibility with legacy API", () => {
    createRun({ evalId });

    const byEvalId = listRuns(evalId);
    const byProjectId = listRuns(undefined, projectId);
    const all = listRuns();

    expect(byEvalId.length).toBeGreaterThan(0);
    expect(byProjectId.length).toBeGreaterThan(0);
    expect(all.length).toBeGreaterThan(0);
  });
});
