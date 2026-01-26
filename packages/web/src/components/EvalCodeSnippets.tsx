import { useState } from "react";
import { EvalWithRelations } from "../lib/api";

interface EvalCodeSnippetsProps {
  evalData: EvalWithRelations;
}

type SnippetTab = "cli" | "api" | "core";

export function EvalCodeSnippets({ evalData }: EvalCodeSnippetsProps) {
  const [activeTab, setActiveTab] = useState<SnippetTab>("cli");
  const [copiedCli, setCopiedCli] = useState(false);
  const [copiedApi, setCopiedApi] = useState(false);
  const [copiedCore, setCopiedCore] = useState(false);

  const cliSnippet = `# Create a new run for this eval
evalstudio run create --eval ${evalData.id}

# Process all queued runs
evalstudio run process

# Or run in watch mode for continuous processing
evalstudio run process --watch`;

  const apiSnippet = `# Create a new run for this eval
curl -X POST http://localhost:3000/api/runs \\
  -H "Content-Type: application/json" \\
  -d '{"evalId": "${evalData.id}"}'

# Get run status (replace RUN_ID with actual ID)
curl http://localhost:3000/api/runs/RUN_ID

# List all runs for this eval
curl "http://localhost:3000/api/runs?evalId=${evalData.id}"

# Retry a failed run
curl -X POST http://localhost:3000/api/runs/RUN_ID/retry`;

  const coreSnippet = `import {
  createRun,
  RunProcessor,
  type Run,
} from "evalstudio";

// Create a new run for the eval
const run = createRun({
  evalId: "${evalData.id}",
});

console.log("Created run:", run.id);

// Option 1: Process runs with RunProcessor (recommended)
const processor = new RunProcessor({
  pollIntervalMs: 2000,
  maxConcurrent: 3,
  onRunStart: (run: Run) => {
    console.log(\`Starting run \${run.id}\`);
  },
  onRunComplete: (run: Run, result) => {
    console.log(\`Run \${run.id} completed in \${result.latencyMs}ms\`);
    if (run.result) {
      console.log(\`Result: \${run.result.success ? "PASSED" : "FAILED"}\`);
    }
  },
  onRunError: (run: Run, error: Error) => {
    console.error(\`Run \${run.id} failed: \${error.message}\`);
  },
});

// Process once (single batch)
await processor.processOnce();

// Or start continuous processing
// processor.start();
// await processor.stop(); // Call to gracefully shutdown`;

  const handleCopy = async (text: string, tab: SnippetTab) => {
    try {
      await navigator.clipboard.writeText(text);
      if (tab === "cli") {
        setCopiedCli(true);
        setTimeout(() => setCopiedCli(false), 2000);
      } else if (tab === "api") {
        setCopiedApi(true);
        setTimeout(() => setCopiedApi(false), 2000);
      } else {
        setCopiedCore(true);
        setTimeout(() => setCopiedCore(false), 2000);
      }
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className="code-snippets">
      <div className="code-snippets-tabs">
        <button
          className={`code-snippets-tab ${activeTab === "cli" ? "active" : ""}`}
          onClick={() => setActiveTab("cli")}
        >
          CLI
        </button>
        <button
          className={`code-snippets-tab ${activeTab === "api" ? "active" : ""}`}
          onClick={() => setActiveTab("api")}
        >
          REST API
        </button>
        <button
          className={`code-snippets-tab ${activeTab === "core" ? "active" : ""}`}
          onClick={() => setActiveTab("core")}
        >
          Core Package
        </button>
      </div>

      <div className="code-snippets-content">
        {activeTab === "cli" && (
          <div className="code-snippet-container">
            <div className="code-snippet-header">
              <span className="code-snippet-label">@evalstudio/cli</span>
              <button
                className="code-snippet-copy"
                onClick={() => handleCopy(cliSnippet, "cli")}
              >
                {copiedCli ? "Copied!" : "Copy"}
              </button>
            </div>
            <pre className="code-snippet">
              <code>{cliSnippet}</code>
            </pre>
          </div>
        )}

        {activeTab === "api" && (
          <div className="code-snippet-container">
            <div className="code-snippet-header">
              <span className="code-snippet-label">@evalstudio/api (curl)</span>
              <button
                className="code-snippet-copy"
                onClick={() => handleCopy(apiSnippet, "api")}
              >
                {copiedApi ? "Copied!" : "Copy"}
              </button>
            </div>
            <pre className="code-snippet">
              <code>{apiSnippet}</code>
            </pre>
          </div>
        )}

        {activeTab === "core" && (
          <div className="code-snippet-container">
            <div className="code-snippet-header">
              <span className="code-snippet-label">evalstudio (TypeScript)</span>
              <button
                className="code-snippet-copy"
                onClick={() => handleCopy(coreSnippet, "core")}
              >
                {copiedCore ? "Copied!" : "Copy"}
              </button>
            </div>
            <pre className="code-snippet">
              <code>{coreSnippet}</code>
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
