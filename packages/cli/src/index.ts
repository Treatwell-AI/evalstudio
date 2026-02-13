#!/usr/bin/env node
import { createRequire } from "module";
import { Command } from "commander";
import { connectorCommand } from "./commands/connector.js";
import { evalCommand } from "./commands/eval.js";
import { initCommand } from "./commands/init.js";
import { llmProviderCommand } from "./commands/llm-provider.js";
import { personaCommand } from "./commands/persona.js";
import { runCommand } from "./commands/run.js";
import { scenarioCommand } from "./commands/scenario.js";
import { serveCommand } from "./commands/serve.js";
import { statusCommand } from "./commands/status.js";
import { ERR_NO_PROJECT } from "@evalstudio/core";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json") as { version: string };

const program = new Command();

program
  .name("evalstudio")
  .description("EvalStudio CLI - Test chatbots, AI agents, and REST APIs")
  .version(packageJson.version);

program.addCommand(initCommand);
program.addCommand(connectorCommand);
program.addCommand(evalCommand);
program.addCommand(llmProviderCommand);
program.addCommand(personaCommand);
program.addCommand(runCommand);
program.addCommand(scenarioCommand);
program.addCommand(serveCommand);
program.addCommand(statusCommand);

program.parseAsync().catch((err: Error) => {
  if ((err as NodeJS.ErrnoException).code === ERR_NO_PROJECT) {
    console.error(`\n${err.message}\n`);
    process.exit(1);
  }
  console.error(err.message || err);
  process.exit(1);
});
