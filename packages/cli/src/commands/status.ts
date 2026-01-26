import { Command } from "commander";
import { getStatus } from "evalstudio";

export const statusCommand = new Command("status")
  .description("Show EvalStudio status")
  .option("--json", "Output as JSON")
  .action((options: { json?: boolean }) => {
    const status = getStatus();

    if (options.json) {
      console.log(JSON.stringify(status, null, 2));
    } else {
      console.log(`EvalStudio Status`);
      console.log(`-----------------`);
      console.log(`Name:      ${status.name}`);
      console.log(`Version:   ${status.version}`);
      console.log(`Status:    ${status.status}`);
      console.log(`Node:      ${status.node}`);
      console.log(`Storage:   ${status.storageDir}`);
      console.log(`Timestamp: ${status.timestamp}`);
    }
  });
