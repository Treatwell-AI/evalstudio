---
slug: /
sidebar_position: 1
---

# Introduction

EvalStudio is a flexible evaluation platform for testing chatbots, AI agents, and REST APIs. Run multi-turn conversation tests or structured JSON evaluations, assess responses with LLM-as-judge, and integrate into your CI/CD pipeline.

## Key Features

- **Multi-turn conversation testing** - Define personas, scenarios, and seed messages to simulate realistic interactions
- **Multiple interfaces** - CLI for developers/CI, Web UI for teams, REST API for automation
- **Pluggable connectors** - Test HTTP endpoints, LangGraph agents (messages or state), or custom implementations
- **Flexible evaluation** - Exact match, regex, JSON schema, JSONPath assertions, or LLM-as-judge
- **Parallel execution** - Run 50-500 evaluations efficiently with configurable concurrency
- **Git-friendly** - Tests stored as JSON files, works seamlessly with version control

## Packages

| Package | Description |
|---------|-------------|
| `evalstudio` | Core evaluation engine (required) |
| `@evalstudio/cli` | Command-line interface |
| `@evalstudio/api` | REST API server with WebSocket |
| `@evalstudio/web` | React-based Web UI |
| `@evalstudio/docs` | Documentation site (you're here!) |

## Quick Links

**Getting Started**
- [Installation](./getting-started/installation)
- [Quick Start](./getting-started/quick-start)

**Reference**
- [Core Library](./core/status) - Status, Projects, Personas, Scenarios, Evals, LLM Providers, Connectors
- [CLI Reference](./cli/status) - Command-line interface
- [API Reference](./api/status) - REST API endpoints
- [Web Dashboard](./web/getting-started) - Browser-based UI
