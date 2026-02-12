import { readFileSync } from "node:fs";
import { join } from "node:path";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { RunProcessor } from "@evalstudio/core";
import { connectorsRoute } from "./routes/connectors.js";
import { evalsRoute } from "./routes/evals.js";
import { llmProvidersRoute } from "./routes/llm-providers.js";
import { personasRoute } from "./routes/personas.js";
import { projectsRoute } from "./routes/projects.js";
import { runsRoute } from "./routes/runs.js";
import { scenariosRoute } from "./routes/scenarios.js";
import { statusRoute } from "./routes/status.js";

export interface ServerOptions {
  logger?: boolean;
  /** Enable background run processing (default: true) */
  runProcessor?: boolean;
  /** Run processor polling interval in ms (default: 5000) */
  runProcessorPollMs?: number;
  /** Maximum concurrent runs (default: 3) */
  runProcessorMaxConcurrent?: number;
  /** Path to built web UI files (enables static file serving) */
  webDistPath?: string;
}

// Global processor instance for graceful shutdown
let runProcessor: RunProcessor | null = null;

export async function createServer(options: ServerOptions = {}) {
  const fastify = Fastify({
    logger: options.logger ?? false,
  });

  // Register all API routes under /api prefix
  await fastify.register(
    async (api) => {
      await api.register(connectorsRoute);
      await api.register(evalsRoute);
      await api.register(llmProvidersRoute);
      await api.register(personasRoute);
      await api.register(projectsRoute);
      await api.register(runsRoute);
      await api.register(scenariosRoute);
      await api.register(statusRoute);
    },
    { prefix: "/api" }
  );

  // Serve static web UI files if webDistPath is provided
  if (options.webDistPath) {
    await fastify.register(fastifyStatic, {
      root: options.webDistPath,
      wildcard: false,
    });

    // SPA fallback: non-API, non-static routes return index.html
    fastify.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith("/api/")) {
        reply.code(404).send({ error: "Not found" });
      } else {
        const indexPath = join(options.webDistPath!, "index.html");
        const html = readFileSync(indexPath, "utf-8");
        reply.type("text/html").send(html);
      }
    });
  }

  // Start the run processor if enabled (default: true)
  const enableProcessor = options.runProcessor ?? true;
  if (enableProcessor) {
    const pollMs = options.runProcessorPollMs ?? 5000;
    const maxConcurrent = options.runProcessorMaxConcurrent ?? 3;

    runProcessor = new RunProcessor({
      pollIntervalMs: pollMs,
      maxConcurrent,
      onRunStart: (run) => {
        console.log(`[RunProcessor] Starting run ${run.id}`);
      },
      onRunComplete: (run, result) => {
        console.log(
          `[RunProcessor] Run ${run.id} completed (${result.latencyMs}ms)`
        );
      },
      onRunError: (run, error) => {
        console.error(`[RunProcessor] Run ${run.id} failed: ${error.message}`);
      },
    });

    runProcessor.start();
    console.log(
      `[RunProcessor] Started (poll: ${pollMs}ms, concurrency: ${maxConcurrent})`
    );
  }

  // Register shutdown hook
  fastify.addHook("onClose", async () => {
    if (runProcessor) {
      console.log("[RunProcessor] Stopping...");
      await runProcessor.stop();
      console.log("[RunProcessor] Stopped");
    }
  });

  return fastify;
}

export async function startServer(port = parseInt(process.env.EVALSTUDIO_PORT || "3000", 10)) {
  const server = await createServer({ logger: true });

  // Handle graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received, shutting down gracefully...`);
    await server.close();
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  try {
    const address = await server.listen({ port, host: "0.0.0.0" });
    console.log(`Server listening at ${address}`);
    return server;
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

/** Get the current run processor instance (for testing/monitoring) */
export function getRunProcessor(): RunProcessor | null {
  return runProcessor;
}
