# EvalStudio - Run Processor Architecture

This document describes the architecture for executing evaluation runs in the background, ensuring runs continue even when users leave the web interface.

## Implementation Status

✅ **Implemented:**
- RunProcessor class in core package (`evalstudio`)
- API server integration (auto-starts on boot)
- CLI `run process` command with watch mode
- Crash recovery (resets stuck runs on startup)
- Atomic claiming (prevents duplicate processing)
- Concurrent execution with configurable limits

🔮 **Future:**
- WebSocket real-time updates
- Multi-turn conversation support
- Priority queues
- Retry logic
- Rate limiting

---

## Quick Start

### API Server (Automatic)

The API server automatically starts the RunProcessor when it boots:

```bash
# Start the API server - processor starts automatically
pnpm --filter @evalstudio/api start
```

Runs created via the web UI or API are automatically processed in the background.

### CLI (Manual)

Process queued runs from the command line:

```bash
# Process all queued runs (one-shot)
evalstudio run process

# Process runs for a specific project
evalstudio run process --project my-project

# Watch mode - continuously process as runs are queued
evalstudio run process --watch

# Custom concurrency (default: 3)
evalstudio run process --concurrency 5

# Custom poll interval in ms (default: 2000)
evalstudio run process --poll 1000
```

---

## Overview

The Run Processor is a background execution system that:
- Processes queued evaluation runs asynchronously
- Continues execution when users close browsers or leave pages
- Provides real-time status updates via callbacks
- Enables recovery from server restarts
- **Works from both CLI and API contexts**

## Design Goals

1. **Persistence**: Runs survive browser closure, page refreshes, and network disconnections
2. **Visibility**: Users see real-time status when they return to the UI
3. **Reliability**: Server crash recovery via status reset on startup
4. **Simplicity**: No external dependencies (Redis, etc.) required initially
5. **Scalability**: Architecture allows future scaling with worker processes
6. **Unified**: Same processor logic for CLI and API execution

---

## Architecture

### Core-Based RunProcessor

The RunProcessor lives in the **core package** (`evalstudio`) so both CLI and API can use it:

```
┌────────────────────────────────────────────────────────────────┐
│                    evalstudio (Core)                           │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                   RunProcessor                            │ │
│  │  - Polls for queued runs                                  │ │
│  │  - Executes via invokeConnector                           │ │
│  │  - Atomic status transitions (prevents duplicates)        │ │
│  │  - Emits events via callbacks                             │ │
│  └──────────────────────────────────────────────────────────┘ │
└─────────────────────────┬──────────────────────────────────────┘
                          │ imports
          ┌───────────────┴───────────────┐
          │                               │
┌─────────▼─────────┐           ┌─────────▼─────────┐
│  @evalstudio/cli  │           │  @evalstudio/api  │
│                   │           │                   │
│  - `run process`  │           │  - Server startup │
│  - Terminal output│           │  - Structured logs│
│  - Watch mode     │           │  - Background     │
│  - One-shot mode  │           │  - Auto-start     │
└───────────────────┘           └───────────────────┘
```

### Coordination: Preventing Duplicate Processing

When both CLI and API might process runs (e.g., developer running CLI while API server is up), we use **atomic status transitions**:

```typescript
// In RunProcessor.claimRun()
private claimRun(runId: string): boolean {
  const run = getRun(runId);
  if (!run || run.status !== "queued") {
    return false; // Already claimed or doesn't exist
  }

  // Update status atomically
  const updated = updateRun(runId, {
    status: "running",
    startedAt: new Date().toISOString(),
  });

  return updated !== undefined;
}
```

This ensures:
- Only one processor executes each run
- No external locking infrastructure needed
- Works with file-based storage (CLI) and future DB storage

### Deployment Scenarios

| Scenario | CLI | API | Notes |
|----------|-----|-----|-------|
| Local dev | ✓ | - | CLI processes directly |
| Web UI only | - | ✓ | API processes in background |
| Mixed | ✓ | ✓ | Both can run; atomic claims prevent duplicates |
| CI/CD | ✓ | - | CLI in pipeline scripts |

---

## Run Status Lifecycle

```
┌─────────┐     ┌─────────┐     ┌───────────┐     ┌───────────┐
│ queued  │────▶│ running │────▶│ completed │  or │  failed   │
└─────────┘     └─────────┘     └───────────┘     └───────────┘
     │               │
     │               │ (on error)
     │               └────────────────────────────▶│
     │
     │ (on server restart, reset stuck runs)
     └◀──────────────┘
```

**Status Definitions:**

| Status | Description |
|--------|-------------|
| `queued` | Run is waiting to be processed |
| `running` | Run is currently being executed |
| `completed` | Run finished successfully |
| `failed` | Run encountered an error |

---

## Actual Implementation

### API Server Integration

The API server (`packages/api/src/index.ts`) starts the RunProcessor automatically:

```typescript
import { RunProcessor } from "evalstudio";

export interface ServerOptions {
  logger?: boolean;
  /** Enable background run processing (default: true) */
  runProcessor?: boolean;
  /** Run processor polling interval in ms (default: 5000) */
  runProcessorPollMs?: number;
  /** Maximum concurrent runs (default: 3) */
  runProcessorMaxConcurrent?: number;
}

// Global processor instance for graceful shutdown
let runProcessor: RunProcessor | null = null;

export async function createServer(options: ServerOptions = {}) {
  const fastify = Fastify({ logger: options.logger ?? false });

  // ... register routes ...

  // Start the run processor if enabled (default: true)
  const enableProcessor = options.runProcessor ?? true;
  if (enableProcessor) {
    runProcessor = new RunProcessor({
      pollIntervalMs: options.runProcessorPollMs ?? 5000,
      maxConcurrent: options.runProcessorMaxConcurrent ?? 3,
      onRunStart: (run) => {
        fastify.log.info({ runId: run.id }, "Run started");
      },
      onRunComplete: (run, result) => {
        fastify.log.info(
          { runId: run.id, latencyMs: result.latencyMs },
          "Run completed"
        );
      },
      onRunError: (run, error) => {
        fastify.log.error(
          { runId: run.id, error: error.message },
          "Run failed"
        );
      },
    });

    runProcessor.start();
    fastify.log.info("Run processor started");
  }

  // Register shutdown hook
  fastify.addHook("onClose", async () => {
    if (runProcessor) {
      await runProcessor.stop();
    }
  });

  return fastify;
}
```

### CLI Integration

The CLI (`packages/cli/src/commands/run.ts`) provides the `run process` command:

```typescript
import { RunProcessor, listRuns, getProject } from "evalstudio";

new Command("process")
  .description("Process queued runs")
  .option("-p, --project <project>", "Only process runs for this project")
  .option("-w, --watch", "Watch mode - continuously process runs")
  .option("-c, --concurrency <number>", "Maximum concurrent runs (default: 3)")
  .option("--poll <ms>", "Poll interval in milliseconds (default: 2000)")
  .action(async (options) => {
    const processor = new RunProcessor({
      pollIntervalMs: options.poll ? parseInt(options.poll, 10) : 2000,
      maxConcurrent: options.concurrency ? parseInt(options.concurrency, 10) : 3,
      projectId: options.project ? resolveProject(options.project)?.id : undefined,
      onRunStart: (run) => {
        console.log(`▶ Starting run ${run.id}`);
      },
      onRunComplete: (run, result) => {
        console.log(`✓ Run ${run.id} completed (${result.latencyMs}ms)`);
      },
      onRunError: (run, error) => {
        console.error(`✗ Run ${run.id} failed: ${error.message}`);
      },
    });

    if (options.watch) {
      // Watch mode: run continuously
      console.log("Starting run processor in watch mode...");
      processor.start();

      // Handle shutdown
      process.on("SIGINT", async () => {
        await processor.stop();
        process.exit(0);
      });

      // Keep the process alive
      await new Promise(() => {});
    } else {
      // One-shot mode: process all queued runs and exit
      let totalProcessed = 0;
      let hasMore = true;

      while (hasMore) {
        const started = await processor.processOnce();
        totalProcessed += started;

        const queued = listRuns({ status: "queued", projectId, limit: 1 });
        hasMore = queued.length > 0;
      }

      console.log(`Processed ${totalProcessed} run(s)`);
    }
  });
```

### CLI Commands

```bash
# Manage runs
evalstudio run create --eval <eval-id> --connector <connector>
evalstudio run list [--project <project>] [--status <status>]
evalstudio run show <run-id>
evalstudio run delete <run-id>

# Process runs
evalstudio run process                          # One-shot: process all queued
evalstudio run process --project my-project     # Filter by project
evalstudio run process --watch                  # Continuous processing
evalstudio run process --concurrency 5          # Custom concurrency
evalstudio run process --poll 1000              # Custom poll interval (ms)
```

---

## Core Package API

The RunProcessor is exported from the main `evalstudio` package:

```typescript
import {
  RunProcessor,
  type RunProcessorOptions,
  type RunStatus,
} from "evalstudio";

// Create processor
const processor = new RunProcessor({
  pollIntervalMs: 5000,       // Poll every 5 seconds
  maxConcurrent: 3,           // Up to 3 concurrent runs
  projectId: "optional-id",   // Optional: filter by project

  // Callbacks
  onStatusChange: (runId, status, run) => { /* ... */ },
  onRunStart: (run) => { /* ... */ },
  onRunComplete: (run, result) => { /* ... */ },
  onRunError: (run, error) => { /* ... */ },
});

// Continuous processing
processor.start();
await processor.stop();  // Graceful shutdown

// One-shot processing
const count = await processor.processOnce();

// Status checks
processor.isRunning();       // boolean
processor.getActiveRunCount(); // number
```

---

## Comparison: CLI vs API Execution

Both use the same `RunProcessor` from core, but with different integration patterns:

| Aspect | CLI Execution | API Execution |
|--------|---------------|---------------|
| Process lifecycle | Tied to terminal session | Runs continuously as daemon |
| User presence | Requires terminal open | Continues without user |
| Status updates | Terminal output | Structured logs |
| Recovery | On next `process` command | Automatic on server startup |
| Project filtering | Via `--project` flag | Can filter or process all |
| Use case | Local dev, CI/CD, one-shot | Production, web UI, always-on |

### When to Use Each

**CLI Processing:**
- Local development and testing
- CI/CD pipelines (run evals as part of build)
- Quick one-off evaluation batches
- When API server isn't running

**API Processing:**
- Production deployments
- Web UI users need background processing
- Always-on evaluation service
- Multi-user environments

### Running Both Simultaneously

It's safe to run both CLI and API processors simultaneously:

1. Both use atomic `claimRun()` to prevent duplicate execution
2. Each processor only executes runs it successfully claims
3. Project filtering allows partitioning (CLI handles project A, API handles project B)

```bash
# Terminal 1: API server processes all projects
pnpm --filter @evalstudio/api start

# Terminal 2: CLI processes specific project with watch
evalstudio run process --project experiments --watch
```

---

## Future Enhancements

### WebSocket Real-Time Updates

Broadcast run status changes to connected web clients:

```typescript
// packages/api/src/websocket.ts
export function broadcastRunStatus(runId: string, status: string, run: Run): void {
  const message = JSON.stringify({ type: "run:status", runId, status, run });
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}
```

### Multi-Turn Conversations

For evaluations requiring multi-turn conversations with the agent:

1. RunProcessor executes first turn
2. Evaluates response with test agent (LLM acting as user)
3. Test agent generates next user message
4. Loop continues until completion criteria met
5. Final evaluation scores the entire conversation

### Priority Queues

Support run priorities for time-sensitive evaluations:

```typescript
interface Run {
  priority?: "high" | "normal" | "low";
}
```

### Retry Logic

Automatic retry for transient failures:

```typescript
interface Run {
  retryCount?: number;
  maxRetries?: number;
}
```

### Rate Limiting

Respect connector rate limits:

```typescript
interface ConnectorConfig {
  rateLimitRpm?: number;  // Requests per minute
}
```
