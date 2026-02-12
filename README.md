# EvalStudio

A flexible evaluation platform for testing chatbots, AI agents, and REST APIs. Run multi-turn conversation tests or structured JSON evaluations, assess responses with LLM-as-judge, and integrate into your CI/CD pipeline.

## Key Features

- **Multi-turn conversation testing** - Define personas, scenarios, and seed messages to simulate realistic interactions
- **Multiple interfaces** - CLI for developers/CI, Web UI for teams, REST API for automation
- **Pluggable connectors** - Test HTTP endpoints, LangGraph agents (messages or state), or custom implementations
- **Flexible evaluation** - Exact match, regex, JSON schema, JSONPath assertions, or LLM-as-judge
- **Parallel execution** - Run 50-500 evaluations efficiently with configurable concurrency
- **Git-friendly** - Tests stored as JSON files, works seamlessly with version control

## Quick Start

```bash
# Install globally
npm install -g @evalstudio/cli

# Initialize a new project directory
evalstudio init my-evals
cd my-evals

# Create a project and start configuring
evalstudio project create --name "My Project"

# Check status
evalstudio status
```

## Packages

| Package            | Description                       |
| ------------------ | --------------------------------- |
| `@evalstudio/core` | Core evaluation engine (required) |
| `@evalstudio/cli`  | Command-line interface            |
| `@evalstudio/api`  | REST API server with WebSocket    |
| `@evalstudio/web`  | React-based Web UI                |
| `@evalstudio/docs` | Documentation site                |

## Documentation

- [SPEC.md](specs/SPEC.md) - Product requirements and feature specifications
- [ARCHITECTURE.md](specs/ARCHITECTURE.md) - System design and technology stack
- [USER-STORIES.md](specs/USER-STORIES.md) - Glossary and user stories

## Development

### Check Status

Verify your EvalStudio installation is working:

**CLI:**
```bash
evalstudio status          # Human-readable output
evalstudio status --json   # JSON output for scripts
```

**API:**
```bash
# Start the API server
pnpm --filter @evalstudio/api start

# Check status
curl http://localhost:3000/status
```

**Programmatic:**
```typescript
import { getStatus } from "@evalstudio/core";

const status = getStatus();
console.log(status);
// { name: "evalstudio", version: "0.0.1", status: "ok", timestamp: "...", node: "v20.x.x" }
```

## Claude Code Commands

When using Claude Code, these slash commands are available:

| Command | Description |
|---------|-------------|
| `/feature` | Start new feature (creates branch, tracks progress) |
| `/feature validate` | Run validation (typecheck, lint, test, build) |
| `/feature changelog` | Generate changelog entry |
| `/feature docs` | Update documentation |
| `/feature complete` | Validate + changelog + commit |
| `/feature status` | Show current feature progress |

Standalone commands (work without active feature):

| Command | Description |
|---------|-------------|
| `/validate` | Run all validation steps |
| `/changelog` | Generate changelog from git history |
| `/docs` | Update documentation |

## Tech Stack

- **Core**: Node.js 20+, TypeScript, LangChain.js/LangGraph.js, Zod
- **CLI**: Commander.js, Ink
- **API**: Fastify
- **Web**: React 18, Vite, TanStack Query, shadcn/ui

## License

MIT
