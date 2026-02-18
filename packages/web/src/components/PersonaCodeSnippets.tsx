import { useState } from "react";
import { Persona } from "../lib/api";
import { useProjectId } from "../hooks/useProjectId";

interface PersonaCodeSnippetsProps {
  persona: Persona;
}

type SnippetTab = "cli" | "api";

export function PersonaCodeSnippets({ persona }: PersonaCodeSnippetsProps) {
  const projectId = useProjectId();
  const [activeTab, setActiveTab] = useState<SnippetTab>("cli");
  const [copiedCli, setCopiedCli] = useState(false);
  const [copiedApi, setCopiedApi] = useState(false);
  const base = `http://localhost:3000/api/projects/${projectId}/personas`;

  const cliSnippet = `# List all personas
evalstudio persona list

# Show this persona
evalstudio persona show ${persona.id}

# Create a new persona
evalstudio persona create \\
  --name "New Persona" \\
  --description "Brief description" \\
  --system-prompt "Full character instructions..."

# Update this persona
evalstudio persona update ${persona.id} \\
  --name "Updated Name" \\
  --description "Updated description" \\
  --system-prompt "Updated instructions..."

# Delete this persona
evalstudio persona delete ${persona.id}`;

  const apiSnippet = `# List all personas
curl "${base}"

# Get this persona
curl "${base}/${persona.id}"

# Create a new persona
curl -X POST ${base} \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "New Persona",
    "description": "Brief description",
    "systemPrompt": "Full character instructions..."
  }'

# Update this persona
curl -X PUT ${base}/${persona.id} \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Updated Name",
    "description": "Updated description",
    "systemPrompt": "Updated instructions..."
  }'

# Delete this persona
curl -X DELETE ${base}/${persona.id}`;

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
