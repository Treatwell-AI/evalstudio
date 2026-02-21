import type { ConnectorInvokeResult } from "./connector.js";
import { getLLMProviderFromProjectConfig, type LLMProvider } from "./llm-provider.js";
import type { Persona } from "./persona.js";
import type { Scenario } from "./scenario.js";
import type { Run, RunStatus, RunResult } from "./run.js";
import { getProjectConfig } from "./project.js";
import { readWorkspaceConfig } from "./project.js";
import type { Message } from "./types.js";
import { buildTestAgentSystemPrompt } from "./prompt.js";
import { evaluateCriteria, type CriteriaEvaluationResult } from "./evaluator.js";
import { generatePersonaMessage } from "./persona-generator.js";
import { createProjectModules, type ProjectModules } from "./module-factory.js";
import type { StorageProvider } from "./storage-provider.js";

/**
 * Resolved LLM configuration for evaluation and persona generation
 */
interface ResolvedLLMConfig {
  llmProvider: LLMProvider;
  evaluationModel?: string;
  personaModel?: string;
}

export type { RunStatus };

export interface RunProcessorOptions {
  /** Workspace root directory */
  workspaceDir: string;
  /** Storage provider for entity and project access */
  storage: StorageProvider;
  /** Polling interval in milliseconds (default: 5000) */
  pollIntervalMs?: number;
  /** Maximum concurrent run executions (default: from workspace config, then 3) */
  maxConcurrent?: number;
  /** Callback for status changes */
  onStatusChange?: (runId: string, status: RunStatus, run: Run) => void;
  /** Callback when a run starts */
  onRunStart?: (run: Run) => void;
  /** Callback when a run completes */
  onRunComplete?: (run: Run, result: ConnectorInvokeResult) => void;
  /** Callback when a run fails */
  onRunError?: (run: Run, error: Error) => void;
}

interface InternalOptions {
  workspaceDir: string;
  storage: StorageProvider;
  pollIntervalMs: number;
  maxConcurrent: number;
  onStatusChange?: (runId: string, status: RunStatus, run: Run) => void;
  onRunStart?: (run: Run) => void;
  onRunComplete?: (run: Run, result: ConnectorInvokeResult) => void;
  onRunError?: (run: Run, error: Error) => void;
}

/**
 * Background processor for executing queued evaluation runs.
 *
 * A single RunProcessor serves all projects in a workspace.
 * On each poll cycle, it iterates over all projects to find queued runs
 * and executes them using each project's effective config.
 *
 * @example
 * ```typescript
 * const processor = new RunProcessor({
 *   workspaceDir: '/path/to/workspace',
 *   storage: await createStorageProvider(workspaceDir),
 *   pollIntervalMs: 5000,
 *   maxConcurrent: 3,
 *   onStatusChange: (runId, status, run) => {
 *     console.log(`Run ${runId} is now ${status}`);
 *   },
 * });
 *
 * processor.start();
 *
 * // Later: graceful shutdown
 * await processor.stop();
 * ```
 */
export class RunProcessor {
  private running = false;
  private intervalId: NodeJS.Timeout | null = null;
  private activeRuns = new Map<string, Promise<void>>();
  private options: InternalOptions;

  constructor(options: RunProcessorOptions) {
    // Read maxConcurrency from workspace config as fallback
    let configMaxConcurrency: number | undefined;
    if (options.maxConcurrent === undefined) {
      try {
        const wsConfig = readWorkspaceConfig(options.workspaceDir);
        configMaxConcurrency = wsConfig.maxConcurrency;
      } catch {
        // No workspace config available, use default
      }
    }

    this.options = {
      workspaceDir: options.workspaceDir,
      storage: options.storage,
      pollIntervalMs: options.pollIntervalMs ?? 5000,
      maxConcurrent: options.maxConcurrent ?? configMaxConcurrency ?? 3,
      onStatusChange: options.onStatusChange,
      onRunStart: options.onRunStart,
      onRunComplete: options.onRunComplete,
      onRunError: options.onRunError,
    };
  }

  /**
   * Starts the processor loop.
   * Call this on server/CLI startup.
   */
  start(): void {
    if (this.running) return;

    this.running = true;

    // Reset any "running" runs to "queued" (recovery from crash)
    this.recoverStuckRuns();

    // Start polling loop
    this.intervalId = setInterval(() => this.tick(), this.options.pollIntervalMs);

    // Immediate first tick
    this.tick();
  }

  /**
   * Stops the processor gracefully.
   * Waits for active runs to complete.
   */
  async stop(): Promise<void> {
    this.running = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // Wait for active runs to complete
    await Promise.all(this.activeRuns.values());
  }

  /**
   * Process a single tick (useful for testing or one-shot processing).
   * Returns the number of runs started and waits for them to complete.
   */
  async processOnce(): Promise<number> {
    return this.tick(true);
  }

  /**
   * Returns true if the processor is currently running.
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Returns the number of currently active runs.
   */
  getActiveRunCount(): number {
    return this.activeRuns.size;
  }

  /**
   * Main processing tick - iterates over all projects to pick up queued runs.
   * Returns the number of runs started.
   * @param oneShot If true, waits for runs to complete before returning
   */
  private async tick(oneShot = false): Promise<number> {
    // Skip if not running and no active runs (unless one-shot mode)
    if (!oneShot && !this.running && this.activeRuns.size === 0) return 0;

    // Calculate available slots
    const availableSlots = this.options.maxConcurrent - this.activeRuns.size;
    if (availableSlots <= 0) return 0;

    const { storage } = this.options;

    // Iterate over all projects to find queued runs
    let projects: Array<{ id: string; name: string }>;
    try {
      projects = await storage.listProjects();
    } catch {
      return 0; // No workspace config yet
    }

    let started = 0;
    const promises: Promise<void>[] = [];
    let remaining = availableSlots;

    for (const project of projects) {
      if (remaining <= 0) break;

      const modules = createProjectModules(storage, project.id);
      const queuedRuns = await modules.runs.list({ status: "queued", limit: remaining });

      for (const run of queuedRuns) {
        if (remaining <= 0) break;
        if (this.activeRuns.has(run.id)) continue;

        // Attempt to claim the run atomically
        const claimed = await this.claimRun(modules, run.id);
        if (!claimed) {
          continue; // Already claimed by another processor
        }

        // Start execution
        const promise = this.executeRun(project.id, modules, run);
        this.activeRuns.set(run.id, promise);
        started++;
        remaining--;

        if (oneShot) {
          promises.push(promise);
        }

        // Clean up when done
        promise.finally(() => this.activeRuns.delete(run.id));
      }
    }

    // In one-shot mode, wait for all runs to complete
    if (oneShot && promises.length > 0) {
      await Promise.all(promises);
    }

    return started;
  }

  /**
   * Atomically claims a run for processing.
   * Returns true if successful, false if already claimed.
   */
  private async claimRun(modules: ProjectModules, runId: string): Promise<boolean> {
    const run = await modules.runs.get(runId);
    if (!run || run.status !== "queued") {
      return false; // Already claimed or doesn't exist
    }

    // Update status atomically
    const updated = await modules.runs.update(runId, {
      status: "running",
      startedAt: new Date().toISOString(),
    });

    return updated !== undefined;
  }

  /**
   * Executes a single run with the evaluation loop.
   *
   * The loop:
   * 1. Sends conversation to tested agent
   * 2. Evaluates agent response against success/failure criteria
   * 3. If success criteria met or failure criteria met, finish the run
   * 4. If max messages reached, finish the run
   * 5. Otherwise, generate a new persona message and continue
   */
  private async executeRun(projectId: string, modules: ProjectModules, run: Run): Promise<void> {
    // Re-fetch run to get updated state after claim
    let currentRun = await modules.runs.get(run.id);
    if (!currentRun) {
      return;
    }

    const { storage, workspaceDir } = this.options;

    try {
      // Notify start
      this.options.onStatusChange?.(currentRun.id, "running", currentRun);
      this.options.onRunStart?.(currentRun);

      // Determine connector ID
      let connectorId: string;

      if (currentRun.evalId) {
        // Eval-based run
        const evalItem = await modules.evals.get(currentRun.evalId);
        if (!evalItem) {
          throw new Error(`Eval not found: ${currentRun.evalId}`);
        }
        if (!evalItem.connectorId) {
          throw new Error("Eval has no connector assigned");
        }
        connectorId = evalItem.connectorId;
      } else {
        // Playground run - connector stored on run
        if (!currentRun.connectorId) {
          throw new Error("Playground run has no connector assigned");
        }
        connectorId = currentRun.connectorId;
      }

      // Get project config for LLM settings
      const config = await getProjectConfig(storage, workspaceDir, projectId);
      const llmProvider = await getLLMProviderFromProjectConfig(storage, workspaceDir, projectId);
      const models = config.llmSettings?.models;
      const evaluationModel = models?.evaluation;
      const personaModel = models?.persona || evaluationModel;

      const llmConfig: ResolvedLLMConfig = {
        llmProvider,
        evaluationModel,
        personaModel,
      };

      // Get scenario and persona from stored IDs
      if (!currentRun.scenarioId) {
        throw new Error(`Run ${currentRun.id} has no scenario`);
      }
      const scenario = await modules.scenarios.get(currentRun.scenarioId);
      if (!scenario) {
        throw new Error(`Scenario not found: ${currentRun.scenarioId}`);
      }

      const persona = currentRun.personaId
        ? await modules.personas.get(currentRun.personaId)
        : undefined;

      // Get eval input messages if this is an eval-based run
      const evalForInput = currentRun.evalId ? await modules.evals.get(currentRun.evalId) : undefined;
      const evalInput = evalForInput?.input;

      // Build all messages including system prompt
      const allMessages = this.buildAllMessages(scenario, persona, evalInput);

      // Store all initial messages in the run (so they're visible in UI)
      const runWithMessages = await modules.runs.update(currentRun.id, {
        messages: allMessages,
      });
      if (runWithMessages) {
        currentRun = runWithMessages;
      }

      // Determine max messages (default to 10 if not specified)
      const maxMessages = scenario.maxMessages ?? 10;

      // Check if we have criteria to evaluate against
      if (!scenario.successCriteria && !scenario.failureCriteria) {
        throw new Error("Scenario must have success or failure criteria defined");
      }

      // Run the evaluation loop
      await this.executeEvaluationLoop(
        modules,
        currentRun,
        connectorId,
        llmConfig,
        scenario,
        persona,
        maxMessages
      );
    } catch (error) {
      const err = error instanceof Error ? error : new Error("Unknown error");
      const updatedRun = await modules.runs.update(currentRun.id, {
        status: "error",
        error: err.message,
        completedAt: new Date().toISOString(),
      });

      if (updatedRun) {
        this.options.onStatusChange?.(currentRun.id, "error", updatedRun);
        this.options.onRunError?.(updatedRun, err);
      }
    }
  }

  /**
   * Gets the thread ID for LangGraph.
   * Uses the stored threadId if available (set on retry), otherwise uses run.id.
   */
  private getThreadId(run: Run): string {
    return run.threadId || run.id;
  }

  /**
   * Gets the role of the last non-system message.
   * Used to determine if we need to generate a persona message before invoking the connector.
   */
  private getLastMessageRole(messages: Message[]): Message["role"] | undefined {
    const nonSystemMessages = messages.filter((m) => m.role !== "system");
    if (nonSystemMessages.length === 0) return undefined;
    return nonSystemMessages[nonSystemMessages.length - 1].role;
  }

  /**
   * Executes the main evaluation loop.
   * Both success and failure criteria are evaluated at every turn.
   * The loop stops when:
   * - Success criteria is met (run succeeds)
   * - Failure criteria is met AND failureCriteriaMode is "every_turn" (run fails early)
   * - Max messages reached without success (run fails; default mode "on_max_messages")
   */
  private async executeEvaluationLoop(
    modules: ProjectModules,
    currentRun: Run,
    connectorId: string,
    llmConfig: ResolvedLLMConfig,
    scenario: Scenario,
    persona: Persona | undefined,
    maxMessages: number
  ): Promise<void> {
    let messages = [...currentRun.messages];
    let totalLatencyMs = 0;
    let connectorCallCount = 0;
    let lastResult: ConnectorInvokeResult | undefined;
    let finalEvaluation: CriteriaEvaluationResult | undefined;

    // Track messages already in the LangGraph thread (for continuation calls)
    let threadMessageCount = 0;

    // Count only user and assistant messages for the limit (exclude system)
    const countConversationMessages = () =>
      messages.filter((m) => m.role === "user" || m.role === "assistant").length;

    // Generate an initial user message if there are no conversation messages
    // or the last seed message is from the assistant
    const lastRole = this.getLastMessageRole(messages);
    if (!lastRole || lastRole === "assistant") {
      const personaResponse = await generatePersonaMessage({
        messages,
        persona,
        scenario,
        llmProvider: llmConfig.llmProvider,
        model: llmConfig.personaModel,
      });

      const userMessage: Message = {
        role: "user",
        content: personaResponse.content,
      };
      messages = [...messages, userMessage];

      // Update run with the generated persona message
      await modules.runs.update(currentRun.id, { messages });
    }

    while (countConversationMessages() < maxMessages) {
      // Build conversation messages (without system prompt) for connector
      const conversationMessages = messages.filter((m) => m.role !== "system");

      // Invoke the connector (send to tested agent, pass thread ID for LangGraph)
      // threadMessageCount tells LangGraph strategy how many messages are already in the thread
      const result = await modules.connectors.invoke(connectorId, {
        messages: conversationMessages,
        runId: this.getThreadId(currentRun),
        threadMessageCount,
        extraHeaders: persona?.headers,
      });
      lastResult = result;

      if (!result.success || !result.messages || result.messages.length === 0) {
        throw new Error(result.error || "No response messages from connector");
      }

      // Add all agent response messages (may include tool calls, tool results, and final response)
      messages = [...messages, ...result.messages];

      // Update thread message count for next iteration (thread now has all conversation messages)
      threadMessageCount = messages.filter((m) => m.role !== "system").length;
      totalLatencyMs += result.latencyMs;
      connectorCallCount++;

      // Update run with current messages
      await modules.runs.update(currentRun.id, { messages });

      // Evaluate the conversation against criteria
      const evaluation = await evaluateCriteria({
        messages,
        successCriteria: scenario.successCriteria,
        failureCriteria: scenario.failureCriteria,
        llmProvider: llmConfig.llmProvider,
        model: llmConfig.evaluationModel,
      });
      finalEvaluation = evaluation;

      // Determine failure criteria check mode (default: "every_turn")
      const failureMode = scenario.failureCriteriaMode ?? "on_max_messages";

      // Stop the loop on success, or on failure when failureCriteriaMode is "every_turn"
      if (evaluation.successMet || (evaluation.failureMet && failureMode === "every_turn")) {
        const runResult: RunResult = {
          success: evaluation.successMet,
          score: evaluation.confidence,
          reason: evaluation.successMet
            ? evaluation.reasoning
            : `Failure criteria was triggered. ${evaluation.reasoning}`,
        };

        const updatedRun = await modules.runs.update(currentRun.id, {
          status: "completed",
          messages,
          result: runResult,
          output: {
            avgLatencyMs: connectorCallCount > 0 ? Math.round(totalLatencyMs / connectorCallCount) : 0,
            totalLatencyMs,
            messageCount: countConversationMessages(),
            evaluation: {
              successMet: evaluation.successMet,
              failureMet: evaluation.failureMet,
              confidence: evaluation.confidence,
              reasoning: evaluation.reasoning,
            },
          },
          completedAt: new Date().toISOString(),
        });

        if (updatedRun && lastResult) {
          this.options.onStatusChange?.(currentRun.id, "completed", updatedRun);
          this.options.onRunComplete?.(updatedRun, lastResult);
        }
        return;
      }

      // Check if we've reached max messages
      if (countConversationMessages() >= maxMessages) {
        break;
      }

      // Generate a new user message to continue the conversation
      // If persona is provided, the message will be personalized; otherwise generic
      const personaResponse = await generatePersonaMessage({
        messages,
        persona,
        scenario,
        llmProvider: llmConfig.llmProvider,
        model: llmConfig.personaModel,
      });

      // Add persona message as user message
      const userMessage: Message = {
        role: "user",
        content: personaResponse.content,
      };
      messages = [...messages, userMessage];

      // Update run with new user message
      await modules.runs.update(currentRun.id, { messages });
    }

    // Max messages reached without meeting success criteria
    const failureTriggered = finalEvaluation?.failureMet ?? false;
    const runResult: RunResult = {
      success: false,
      score: finalEvaluation?.confidence ?? 0,
      reason: failureTriggered
        ? `Failure criteria was triggered. ${finalEvaluation?.reasoning || ""}`
        : `Max messages (${maxMessages}) reached without meeting success criteria. ${finalEvaluation?.reasoning || ""}`,
    };

    const updatedRun = await modules.runs.update(currentRun.id, {
      status: "completed",
      messages,
      result: runResult,
      output: {
        avgLatencyMs: connectorCallCount > 0 ? Math.round(totalLatencyMs / connectorCallCount) : 0,
        totalLatencyMs,
        messageCount: countConversationMessages(),
        maxMessagesReached: true,
        evaluation: finalEvaluation
          ? {
              successMet: finalEvaluation.successMet,
              failureMet: finalEvaluation.failureMet,
              confidence: finalEvaluation.confidence,
              reasoning: finalEvaluation.reasoning,
            }
          : undefined,
      },
      completedAt: new Date().toISOString(),
    });

    if (updatedRun && lastResult) {
      this.options.onStatusChange?.(currentRun.id, "completed", updatedRun);
      this.options.onRunComplete?.(updatedRun, lastResult);
    }
  }

  /**
   * Builds all messages including system prompt for a run.
   * These messages are stored in the run for visibility in the UI.
   */
  private buildAllMessages(
    scenario: Scenario,
    persona: Persona | undefined,
    evalInput?: Message[] | Record<string, unknown>
  ): Message[] {
    const messages: Message[] = [];

    // Add system prompt from persona/scenario
    const systemPrompt = buildTestAgentSystemPrompt({
      persona: persona
        ? {
            name: persona.name,
            description: persona.description,
            systemPrompt: persona.systemPrompt,
          }
        : undefined,
      scenario: {
        name: scenario.name,
        instructions: scenario.instructions,
        messages: scenario.messages,
      },
    });
    if (systemPrompt.trim()) {
      messages.push({ role: "system", content: systemPrompt });
    }

    // Add scenario seed messages if present
    if (scenario.messages) {
      messages.push(...scenario.messages);
    }

    // Add eval input messages (only for eval-based runs)
    if (Array.isArray(evalInput)) {
      messages.push(...(evalInput as Message[]));
    }

    return messages;
  }

  /**
   * Recovers runs that were interrupted by server crash.
   * Iterates over all projects to find stuck runs.
   */
  private async recoverStuckRuns(): Promise<void> {
    const { storage } = this.options;

    let projects: Array<{ id: string; name: string }>;
    try {
      projects = await storage.listProjects();
    } catch {
      return;
    }

    for (const project of projects) {
      try {
        const modules = createProjectModules(storage, project.id);

        const stuckRuns = await modules.runs.list({ status: "running" });
        for (const run of stuckRuns) {
          await modules.runs.update(run.id, { status: "queued" });
        }
      } catch {
        // Skip projects that can't be resolved
      }
    }
  }
}
