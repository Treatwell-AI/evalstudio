import { useState } from "react";
import { Scenario } from "../lib/api";

interface ScenarioCodeSnippetsProps {
  scenario: Scenario;
}

type SnippetTab = "cli" | "api";

export function ScenarioCodeSnippets({ scenario }: ScenarioCodeSnippetsProps) {
  const [activeTab, setActiveTab] = useState<SnippetTab>("cli");
  const [copiedCli, setCopiedCli] = useState(false);
  const [copiedApi, setCopiedApi] = useState(false);

  const cliSnippet = `# List all scenarios
evalstudio scenario list

# Show this scenario
evalstudio scenario show ${scenario.id}

# Create a new scenario
evalstudio scenario create \\
  --name "New Scenario" \\
  --instructions "Customer wants to..." \\
  --max-messages 10 \\
  --success-criteria "Agent successfully..." \\
  --failure-criteria "Agent fails to..." \\
  --failure-criteria-mode on_max_messages

# Update this scenario
evalstudio scenario update ${scenario.id} \\
  --name "Updated Name" \\
  --instructions "Updated instructions..."

# Delete this scenario
evalstudio scenario delete ${scenario.id}`;

  const apiSnippet = `# List all scenarios
curl "http://localhost:3000/api/scenarios"

# Get this scenario
curl "http://localhost:3000/api/scenarios/${scenario.id}"

# Create a new scenario
curl -X POST http://localhost:3000/api/scenarios \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "New Scenario",
    "instructions": "Customer wants to...",
    "maxMessages": 10,
    "successCriteria": "Agent successfully...",
    "failureCriteria": "Agent fails to...",
    "failureCriteriaMode": "on_max_messages"
  }'

# Update this scenario
curl -X PUT http://localhost:3000/api/scenarios/${scenario.id} \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Updated Name",
    "instructions": "Updated instructions..."
  }'

# Delete this scenario
curl -X DELETE http://localhost:3000/api/scenarios/${scenario.id}`;

  const handleCopy = async (text: string, tab: SnippetTab) => {
    try {
      await navigator.clipboard.writeText(text);
      if (tab === "cli") {
        setCopiedCli(true);
        setTimeout(() => setCopiedCli(false), 2000);
      } else {
        setCopiedApi(true);
        setTimeout(() => setCopiedApi(false), 2000);
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
      </div>
    </div>
  );
}
