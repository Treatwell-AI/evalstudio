import { createRequire } from "module";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json") as { version: string };

export interface Status {
  name: string;
  version: string;
  status: "ok" | "error";
  timestamp: string;
  node: string;
}

export function getStatus(): Status {
  return {
    name: "evalstudio",
    version: packageJson.version,
    status: "ok",
    timestamp: new Date().toISOString(),
    node: process.version,
  };
}
