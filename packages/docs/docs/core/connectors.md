---
sidebar_position: 7
---

# Connectors

Manage connector configurations for bridging EvalStudio to external API endpoints. Connectors define how to connect to target systems like LangGraph Dev API or generic HTTP endpoints.

## Import

```typescript
import {
  createConnector,
  getConnector,
  getConnectorByName,
  listConnectors,
  updateConnector,
  deleteConnector,
  getConnectorTypes,
  testConnector,
  invokeConnector,
  type Connector,
  type ConnectorType,
  type AuthType,
  type ConnectorConfig,
  type LangGraphConnectorConfig,
  type HttpConnectorConfig,
  type CreateConnectorInput,
  type UpdateConnectorInput,
  type ConnectorTestResult,
  type ConnectorInvokeInput,
  type ConnectorInvokeResult,
  type Message,
} from "@evalstudio/core";
```

## Types

### ConnectorType

```typescript
type ConnectorType = "http" | "langgraph";
```

Supported connector types:
- `http` - Generic HTTP/REST API connector
- `langgraph` - LangGraph Dev API connector for langgraph-backed agents

### AuthType

```typescript
type AuthType = "none" | "api-key" | "bearer" | "basic";
```

Supported authentication types:
- `none` - No authentication
- `api-key` - API key authentication
- `bearer` - Bearer token authentication
- `basic` - Basic authentication (base64 encoded credentials)

### Connector

```typescript
interface Connector {
  id: string;              // Unique identifier (UUID)
  name: string;            // Connector name (unique)
  type: ConnectorType;     // Connector type (http or langgraph)
  baseUrl: string;         // Base URL for the API endpoint
  authType?: AuthType;     // Authentication type
  authValue?: string;      // Authentication value (API key, token, etc.)
  config?: ConnectorConfig; // Optional configuration
  createdAt: string;       // ISO 8601 timestamp
  updatedAt: string;       // ISO 8601 timestamp
}
```

### CreateConnectorInput

```typescript
interface CreateConnectorInput {
  name: string;
  type: ConnectorType;
  baseUrl: string;
  authType?: AuthType;
  authValue?: string;
  config?: ConnectorConfig;
}
```

### UpdateConnectorInput

```typescript
interface UpdateConnectorInput {
  name?: string;
  type?: ConnectorType;
  baseUrl?: string;
  authType?: AuthType;
  authValue?: string;
  config?: ConnectorConfig;
}
```

### ConnectorTestResult

```typescript
interface ConnectorTestResult {
  success: boolean;    // Whether the test passed
  latencyMs: number;   // Response time in milliseconds
  response?: string;   // Response message (on success)
  error?: string;      // Error message (on failure)
}
```

### ConnectorInvokeInput

```typescript
interface ConnectorInvokeInput {
  messages: Message[];  // Array of messages to send
  runId?: string;       // Optional run ID to use as thread_id (LangGraph only)
}
```

### ConnectorInvokeResult

```typescript
interface ConnectorInvokeResult {
  success: boolean;       // Whether the invocation succeeded
  latencyMs: number;      // Response time in milliseconds
  message?: Message;      // Assistant response message (on success)
  rawResponse?: string;   // Raw response text (first 2000 chars)
  error?: string;         // Error message (on failure)
}
```

### Message

Messages support both standard OpenAI chat format and LangGraph extensions:

```typescript
interface Message {
  role: "user" | "assistant" | "system" | "tool";
  content: string | ContentBlock[];
  tool_calls?: ToolCall[];           // Tool invocations by assistant
  tool_call_id?: string;             // ID for tool response messages
  name?: string;                     // Tool name for tool messages
  additional_kwargs?: Record<string, unknown>;  // Extra metadata
  response_metadata?: Record<string, unknown>;  // Model response metadata
  id?: string;                       // Message ID
}

interface ToolCall {
  id?: string;
  name: string;
  args: Record<string, unknown>;
  type?: string;
}

interface ContentBlock {
  type: string;
  text?: string;
  [key: string]: unknown;
}
```

### LangGraphConnectorConfig

Type-safe configuration for LangGraph Dev API connectors.

```typescript
interface LangGraphConnectorConfig {
  assistantId: string;              // The assistant ID to invoke (required)
}
```

### HttpConnectorConfig

Type-safe configuration for generic HTTP/REST API connectors.

```typescript
interface HttpConnectorConfig {
  method?: "GET" | "POST" | "PUT" | "PATCH"; // HTTP method (default: POST)
  headers?: Record<string, string>;          // Additional headers
  timeout?: number;                          // Request timeout in ms
  path?: string;                             // Path to append to base URL
}
```

### ConnectorConfig

Union type for all connector configurations.

```typescript
type ConnectorConfig = LangGraphConnectorConfig | HttpConnectorConfig;
```

## Functions

### createConnector()

Creates a new connector.

```typescript
function createConnector(input: CreateConnectorInput): Connector;
```

**Throws**: Error if a connector with the same name already exists.

```typescript
// HTTP connector
const httpConnector = createConnector({
  name: "Production API",
  type: "http",
  baseUrl: "https://api.example.com",
  authType: "bearer",
  authValue: "my-token",
});

// LangGraph connector
const langGraphConnector = createConnector({
  name: "LangGraph Dev",
  type: "langgraph",
  baseUrl: "http://localhost:8123",
  config: {
    assistantId: "my-assistant",
  },
});
```

### getConnector()

Gets a connector by its ID.

```typescript
function getConnector(id: string): Connector | undefined;
```

```typescript
const connector = getConnector("987fcdeb-51a2-3bc4-d567-890123456789");
if (connector) {
  console.log(connector.name);
}
```

### getConnectorByName()

Gets a connector by name.

```typescript
function getConnectorByName(name: string): Connector | undefined;
```

```typescript
const connector = getConnectorByName("LangGraph Dev");
```

### listConnectors()

Lists all connectors in the project.

```typescript
function listConnectors(): Connector[];
```

```typescript
const allConnectors = listConnectors();
```

### updateConnector()

Updates an existing connector.

```typescript
function updateConnector(id: string, input: UpdateConnectorInput): Connector | undefined;
```

**Throws**: Error if updating to a name that already exists.

```typescript
const updated = updateConnector(connector.id, {
  baseUrl: "https://new.api.com",
  authType: "api-key",
  authValue: "new-api-key",
});
```

### deleteConnector()

Deletes a connector by its ID.

```typescript
function deleteConnector(id: string): boolean;
```

```typescript
const deleted = deleteConnector(connector.id);
console.log(deleted ? "Deleted" : "Not found");
```

### getConnectorTypes()

Returns the supported connector types with descriptions.

```typescript
function getConnectorTypes(): Record<ConnectorType, string>;
```

```typescript
const types = getConnectorTypes();
console.log(types.http);      // "Generic HTTP/REST API connector"
console.log(types.langgraph); // "LangGraph Dev API connector for langgraph-backed agents"
```

### testConnector()

Tests a connector's connectivity by sending a "hello" message and checking the response.

```typescript
function testConnector(id: string): Promise<ConnectorTestResult>;
```

```typescript
const result = await testConnector(connector.id);

if (result.success) {
  console.log(`Connected in ${result.latencyMs}ms`);
  console.log(`Response: ${result.response}`);
} else {
  console.error(`Failed: ${result.error}`);
}
```

For HTTP connectors, sends a POST request with `{"message": "hello"}`. For LangGraph connectors, sends a request to the `/runs/wait` endpoint with a "hello" user message and waits for completion.

### invokeConnector()

Invokes a connector by sending messages and returning the assistant's response. For LangGraph connectors, this waits for the run to complete before returning.

```typescript
function invokeConnector(
  id: string,
  input: ConnectorInvokeInput
): Promise<ConnectorInvokeResult>;
```

```typescript
const result = await invokeConnector(connector.id, {
  messages: [
    { role: "user", content: "Hello, how can you help me?" }
  ]
});

if (result.success && result.message) {
  console.log(`Response: ${result.message.content}`);
  console.log(`Latency: ${result.latencyMs}ms`);

  // LangGraph responses may include tool calls
  if (result.message.tool_calls) {
    for (const call of result.message.tool_calls) {
      console.log(`Tool: ${call.name}, Args: ${JSON.stringify(call.args)}`);
    }
  }
} else {
  console.error(`Error: ${result.error}`);
}
```

For HTTP connectors, sends messages as a POST body. For LangGraph connectors, uses the `/threads/{thread_id}/runs/wait` endpoint which waits for the run to complete before returning the full response including any tool calls.

When `runId` is provided for LangGraph connectors, a thread is created with that ID (if it doesn't exist) and all runs are executed within that thread. This enables better organization and tracing of evaluation runs in LangSmith. Multi-turn conversations use `multitask_strategy: "enqueue"` to properly queue requests on the same thread.

## Configuration Examples

### LangGraph Connector Config

```typescript
const config: LangGraphConnectorConfig = {
  assistantId: "my-assistant",  // Required: Assistant ID to use
};
```

### HTTP Connector Config

```typescript
const config: HttpConnectorConfig = {
  method: "POST",               // Optional: HTTP method (default: POST)
  headers: {                    // Optional: Custom headers
    "X-Custom-Header": "value",
  },
  timeout: 30000,               // Optional: Request timeout in ms
  path: "/v1/chat",             // Optional: Path to append to base URL
};
```

## Storage

Connectors are stored in `data/connectors.json` within the project directory.
