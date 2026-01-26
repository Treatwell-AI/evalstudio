import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export const serveCommand = new Command("serve")
  .description("Start the EvalStudio API server and web UI")
  .option("-p, --port <number>", "Port to listen on (env: EVALSTUDIO_PORT)", process.env.EVALSTUDIO_PORT || "3000")
  .option("--no-web", "Disable web UI (API only)")
  .option("--no-processor", "Disable background run processor")
  .option("--open", "Open browser after starting")
  .action(
    async (options: {
      port: string;
      web: boolean;
      processor: boolean;
      open: boolean;
    }) => {
      const { createServer } = await import("@evalstudio/api");

      const port = parseInt(options.port, 10);
      if (isNaN(port) || port < 0 || port > 65535) {
        console.error(`Invalid port: ${options.port}`);
        process.exit(1);
      }

      // Resolve web dist path (shipped alongside CLI dist)
      let webDistPath: string | undefined;
      if (options.web) {
        const candidate = join(__dirname, "..", "..", "web-dist");
        if (existsSync(candidate)) {
          webDistPath = candidate;
        }
      }

      const server = await createServer({
        logger: true,
        runProcessor: options.processor,
        webDistPath,
      });

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

        console.log("");
        console.log(`  EvalStudio server started`);
        console.log(`  API:  ${address}/api`);
        if (webDistPath) {
          console.log(`  Web:  ${address}`);
        } else {
          console.log(`  Web:  not available (web-dist not found)`);
        }
        if (options.processor) {
          console.log(`  Run processor: enabled`);
        }
        console.log("");

        if (options.open && webDistPath) {
          const { exec } = await import("node:child_process");
          const cmd =
            process.platform === "darwin"
              ? `open "${address}"`
              : process.platform === "win32"
                ? `start "${address}"`
                : `xdg-open "${address}"`;
          exec(cmd);
        }
      } catch (err) {
        console.error("Failed to start server:", err);
        process.exit(1);
      }
    }
  );
