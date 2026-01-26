# EvalStudio - API Key Authentication

This document describes the architecture for introducing API key authentication to protect the EvalStudio API endpoints.

## Implementation Status

🔮 **Planned:**
- API key storage in core package
- CLI commands for key management
- Fastify authentication middleware
- Web client API key via environment variable

---

## Overview

API key authentication provides a simple, stateless mechanism to secure the EvalStudio API. This ensures that only authorized clients can access and modify evaluation data.

## Design Goals

1. **Simplicity**: No external auth services required (OAuth, OIDC, etc.)
2. **Stateless**: Each request is independently authenticated via header
3. **Developer-Friendly**: Easy first-time setup via CLI
4. **Environment-Based**: Web package reads API key from environment variable (no UI setup)
5. **Secure**: Keys are hashed in storage, never logged or exposed

---

## Design Rationale: Why API-Only Auth?

### The Question

Should authentication be enforced at the **core level** (protecting all operations) or only at the **API level** (protecting network access)?

```
Option A: API-only auth (this spec)
  CLI ──▶ Core ──▶ Storage     (no auth)
  API ──▶ Core ──▶ Storage     (auth at API layer)

Option B: Core-level auth
  CLI ──▶ Core ──▶ Storage     (auth at core)
  API ──▶ Core ──▶ Storage     (auth at core)
```

### Industry Precedent

EvalStudio is a **local-first developer tool** for building and testing agents. Similar tools follow a consistent pattern:

| Tool | Local CLI Auth | Cloud/API Auth | Pattern |
|------|---------------|----------------|---------|
| **LangSmith** | None | `LANGCHAIN_API_KEY` | Local free, cloud needs key |
| **Promptfoo** | None | API key for cloud only | Local free, cloud needs key |
| **Braintrust** | None | `BRAINTRUST_API_KEY` | Local free, cloud needs key |
| **Weights & Biases** | `wandb login` (one-time) | Stored in `~/.netrc` | Login once, then transparent |
| **OpenAI/Anthropic SDK** | None | `OPENAI_API_KEY` | Key is for external API, not local protection |
| **Terraform** | None | Cloud provider creds separate | Local state unprotected |
| **Docker** | None locally | Registry auth separate | Local daemon open |

**The pattern**: For local-first developer tools, authentication protects **network boundaries**, not local filesystem access.

### Threat Model

```
┌─────────────────────────────────────────────────────────────────────────┐
│  LOCAL MACHINE (trusted)                                                │
│                                                                         │
│   CLI ──────▶ Core ──────▶ ~/.evalstudio/*.json                        │
│                  │                                                      │
│                  │  No auth needed - same trust level                   │
│                  │  (if you can run CLI, you can read the files)        │
│                                                                         │
└──────────────────┼──────────────────────────────────────────────────────┘
                   │
═══════════════════╪═══════════════════════════════════════════════════════
    NETWORK BOUNDARY (untrusted)       ▲ Auth required here
                   │
┌──────────────────┼──────────────────────────────────────────────────────┐
│   Browser ──────▶ API Server ──────▶ Core                               │
│                      │                                                  │
│              X-API-Key validation                                       │
└─────────────────────────────────────────────────────────────────────────┘
```

**Why no CLI/core auth?**
- Developers already have filesystem access to `~/.evalstudio/*.json`
- Adding auth would be security theater - no actual protection gained
- Adds friction without meaningful security benefit
- Not what developers expect from local tools

**Why API auth?**
- Browser → API server crosses a network boundary
- External services (CI/CD, other machines) need controlled access
- Future: team sharing, cloud sync features

### Decision

**API-only auth** because:
1. Matches industry practice for local-first developer tools
2. Protects the actual trust boundary (network access)
3. Avoids unnecessary friction for local development
4. Aligns with developer expectations

**Future consideration**: If EvalStudio adds cloud/team features, a `evalstudio login` command would authenticate with the cloud service - but local operations would remain auth-free.

---

## Package Impact Analysis

### ✅ Packages That WILL Be Modified

| Package | Changes Required |
|---------|------------------|
| **packages/core** | Add API key entity, CRUD operations, validation logic |
| **packages/api** | Add authentication middleware, key validation endpoints |
| **packages/web** | Read API key from env var, inject in all request headers |
| **packages/cli** | Add `api-key` commands for key management |

### ❌ Packages That Will NOT Be Modified

| Package | Reason |
|---------|--------|
| **packages/docs** | Static documentation - no runtime authentication needed |

---

## Architecture

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         FIRST-TIME SETUP FLOW                           │
│                                                                         │
│  1. User installs evalstudio                                           │
│  2. User runs: evalstudio api-key create --name "default"              │
│  3. CLI generates key, stores hash in ~/.evalstudio/api-keys.json      │
│  4. CLI outputs plain-text key ONCE (user must save it)                │
│  5. User adds key to .env file: EVALSTUDIO_API_KEY=es_xxx...      │
│  6. User starts API server and web UI                                  │
│  7. Web reads key from env, includes in all requests automatically     │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                         RUNTIME AUTH FLOW                               │
│                                                                         │
│   Web Browser                    API Server                   Core      │
│   ──────────                     ──────────                   ────      │
│       │                              │                          │       │
│       │  GET /api/projects           │                          │       │
│       │  X-API-Key: es_xxxx...       │                          │       │
│       │─────────────────────────────▶│                          │       │
│       │                              │                          │       │
│       │                              │  validateApiKey(key)     │       │
│       │                              │─────────────────────────▶│       │
│       │                              │                          │       │
│       │                              │  ◀─ { valid: true }      │       │
│       │                              │◀─────────────────────────│       │
│       │                              │                          │       │
│       │                              │  listProjects()          │       │
│       │                              │─────────────────────────▶│       │
│       │                              │                          │       │
│       │  ◀─ 200 OK [projects...]     │                          │       │
│       │◀─────────────────────────────│                          │       │
│       │                              │                          │       │
└─────────────────────────────────────────────────────────────────────────┘
```

### Storage Structure

API keys are stored in the core storage directory alongside other entities:

```
~/.evalstudio/
├── projects.json
├── scenarios.json
├── personas.json
├── evals.json
├── connectors.json
├── llm-providers.json
├── runs.json
└── api-keys.json          ◀── NEW
```

---

## Core Package Changes

### New Entity: ApiKey

```typescript
// packages/core/src/api-key.ts

export interface ApiKey {
  id: string;                    // UUID
  name: string;                  // Human-readable name (e.g., "default", "ci-pipeline")
  keyHash: string;               // SHA-256 hash of the actual key
  keyPrefix: string;             // First 8 chars for identification (e.g., "es_a1b2c3d4")
  createdAt: string;             // ISO timestamp
  lastUsedAt?: string;           // ISO timestamp of last successful auth
  expiresAt?: string;            // Optional expiration
  scopes?: string[];             // Future: permission scopes
}

export interface ApiKeyCreateInput {
  name: string;
  expiresAt?: string;
}

export interface ApiKeyCreateResult {
  apiKey: ApiKey;                // The stored key (without plain text)
  plainTextKey: string;          // The actual key - ONLY returned on creation
}
```

### Key Format

API keys follow a recognizable format for easy identification:

```
es_[32 random alphanumeric characters]

Example: es_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

- Prefix `es_` identifies it as an EvalStudio key
- 32 characters provide sufficient entropy (~190 bits)
- Alphanumeric only (no special chars) for easy copy/paste

### CRUD Operations

```typescript
// packages/core/src/api-key.ts

import { randomBytes, createHash } from "crypto";

const KEY_PREFIX = "es_";
const KEY_LENGTH = 32;

export function createApiKey(input: ApiKeyCreateInput): ApiKeyCreateResult {
  // Generate random key
  const randomPart = randomBytes(KEY_LENGTH).toString("base64url").slice(0, KEY_LENGTH);
  const plainTextKey = `${KEY_PREFIX}${randomPart}`;

  // Hash for storage
  const keyHash = createHash("sha256").update(plainTextKey).digest("hex");
  const keyPrefix = plainTextKey.slice(0, 12); // "es_" + first 8 chars

  const apiKey: ApiKey = {
    id: generateId(),
    name: input.name,
    keyHash,
    keyPrefix,
    createdAt: new Date().toISOString(),
    expiresAt: input.expiresAt,
  };

  // Store in api-keys.json
  const keys = loadApiKeys();
  keys.push(apiKey);
  saveApiKeys(keys);

  return { apiKey, plainTextKey };
}

export function validateApiKey(plainTextKey: string): ApiKey | null {
  if (!plainTextKey.startsWith(KEY_PREFIX)) {
    return null;
  }

  const keyHash = createHash("sha256").update(plainTextKey).digest("hex");
  const keys = loadApiKeys();

  const key = keys.find(k => k.keyHash === keyHash);

  if (!key) {
    return null;
  }

  // Check expiration
  if (key.expiresAt && new Date(key.expiresAt) < new Date()) {
    return null;
  }

  // Update last used timestamp
  updateApiKey(key.id, { lastUsedAt: new Date().toISOString() });

  return key;
}

export function listApiKeys(): ApiKey[] {
  return loadApiKeys();
}

export function getApiKey(id: string): ApiKey | undefined {
  return loadApiKeys().find(k => k.id === id);
}

export function deleteApiKey(id: string): boolean {
  const keys = loadApiKeys();
  const index = keys.findIndex(k => k.id === id);
  if (index === -1) return false;

  keys.splice(index, 1);
  saveApiKeys(keys);
  return true;
}

export function revokeApiKey(id: string): boolean {
  // Alias for delete - revocation is permanent
  return deleteApiKey(id);
}
```

### Export from Core

```typescript
// packages/core/src/index.ts

export {
  createApiKey,
  validateApiKey,
  listApiKeys,
  getApiKey,
  deleteApiKey,
  revokeApiKey,
  type ApiKey,
  type ApiKeyCreateInput,
  type ApiKeyCreateResult,
} from "./api-key.js";
```

---

## API Package Changes

### Authentication Middleware

```typescript
// packages/api/src/middleware/auth.ts

import { FastifyRequest, FastifyReply } from "fastify";
import { validateApiKey } from "evalstudio";

const PUBLIC_ROUTES = [
  "/status",           // Health check
];

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const path = request.url.split("?")[0];

  // Allow public routes
  if (PUBLIC_ROUTES.some(route => path === route || path === `/api${route}`)) {
    return;
  }

  const apiKey = request.headers["x-api-key"] as string | undefined;

  if (!apiKey) {
    reply.code(401).send({
      error: "Unauthorized",
      message: "Missing X-API-Key header",
    });
    return;
  }

  const validKey = validateApiKey(apiKey);

  if (!validKey) {
    reply.code(401).send({
      error: "Unauthorized",
      message: "Invalid or expired API key",
    });
    return;
  }

  // Attach key info to request for logging/auditing
  request.apiKey = validKey;
}

// Type augmentation for Fastify
declare module "fastify" {
  interface FastifyRequest {
    apiKey?: ApiKey;
  }
}
```

### Register Middleware

```typescript
// packages/api/src/index.ts

import { authMiddleware } from "./middleware/auth.js";

export async function createServer(options: ServerOptions = {}) {
  const fastify = Fastify({ logger: options.logger ?? false });

  // Register authentication middleware (runs before all routes)
  fastify.addHook("preHandler", authMiddleware);

  // ... existing route registration ...
}
```

### API Key Management Endpoints

Optional endpoints for managing API keys via the API (all protected):

```typescript
// packages/api/src/routes/api-keys.ts

import { FastifyInstance } from "fastify";
import { listApiKeys, deleteApiKey } from "evalstudio";

export async function apiKeysRoutes(fastify: FastifyInstance): Promise<void> {
  // PROTECTED: List all keys (metadata only, no hashes)
  fastify.get("/api-keys", async () => {
    const keys = listApiKeys();
    return keys.map(k => ({
      id: k.id,
      name: k.name,
      keyPrefix: k.keyPrefix,
      createdAt: k.createdAt,
      lastUsedAt: k.lastUsedAt,
      expiresAt: k.expiresAt,
    }));
  });

  // PROTECTED: Revoke a key
  fastify.delete("/api-keys/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const deleted = deleteApiKey(id);

    if (!deleted) {
      reply.code(404).send({ error: "API key not found" });
      return;
    }

    reply.code(204).send();
  });
}
```

---

## CLI Package Changes

### New Command Group: api-key

```typescript
// packages/cli/src/commands/api-key.ts

import { Command } from "commander";
import {
  createApiKey,
  listApiKeys,
  deleteApiKey,
  getApiKey,
} from "evalstudio";

export const apiKeyCommand = new Command("api-key")
  .description("Manage API keys for authentication");

// CREATE
apiKeyCommand
  .command("create")
  .description("Create a new API key")
  .requiredOption("-n, --name <name>", "Name for the API key")
  .option("--expires <date>", "Expiration date (ISO format)")
  .action((options) => {
    const result = createApiKey({
      name: options.name,
      expiresAt: options.expires,
    });

    console.log("\n✓ API key created successfully!\n");
    console.log("┌─────────────────────────────────────────────────────────┐");
    console.log("│  IMPORTANT: Save this key now. It cannot be shown again │");
    console.log("└─────────────────────────────────────────────────────────┘\n");
    console.log(`  Name:    ${result.apiKey.name}`);
    console.log(`  Key:     ${result.plainTextKey}`);
    console.log(`  Created: ${result.apiKey.createdAt}`);
    if (result.apiKey.expiresAt) {
      console.log(`  Expires: ${result.apiKey.expiresAt}`);
    }
    console.log("\nUse this key in the X-API-Key header for API requests.");
    console.log("For the web UI, add to .env: EVALSTUDIO_API_KEY=<key>\n");
  });

// LIST
apiKeyCommand
  .command("list")
  .description("List all API keys")
  .action(() => {
    const keys = listApiKeys();

    if (keys.length === 0) {
      console.log("\nNo API keys found. Create one with:");
      console.log("  evalstudio api-key create --name <name>\n");
      return;
    }

    console.log("\nAPI Keys:\n");
    console.log("ID                                   Name           Prefix         Created");
    console.log("─".repeat(85));

    for (const key of keys) {
      const created = new Date(key.createdAt).toLocaleDateString();
      console.log(
        `${key.id}  ${key.name.padEnd(14)} ${key.keyPrefix.padEnd(14)} ${created}`
      );
    }
    console.log();
  });

// REVOKE
apiKeyCommand
  .command("revoke <id>")
  .description("Revoke (delete) an API key")
  .action((id) => {
    const key = getApiKey(id);

    if (!key) {
      console.error(`\n✗ API key not found: ${id}\n`);
      process.exit(1);
    }

    const deleted = deleteApiKey(id);

    if (deleted) {
      console.log(`\n✓ API key "${key.name}" (${key.keyPrefix}...) has been revoked.\n`);
    } else {
      console.error("\n✗ Failed to revoke API key.\n");
      process.exit(1);
    }
  });
```

### Register Command

```typescript
// packages/cli/src/index.ts

import { apiKeyCommand } from "./commands/api-key.js";

program.addCommand(apiKeyCommand);
```

---

## Web Package Changes

### Environment Variable Configuration

The web package reads the API key from an environment variable at build time:

```bash
# packages/web/.env (or .env.local for local development)
EVALSTUDIO_API_KEY=es_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

### API Client Updates

```typescript
// packages/web/src/lib/api.ts

// Read from environment variable (exposed at build time)
const API_KEY = import.meta.env.EVALSTUDIO_API_KEY as string | undefined;

function getApiKey(): string | null {
  if (!API_KEY) {
    console.warn(
      "EVALSTUDIO_API_KEY not set. API requests will fail.\n" +
      "Create a key with: evalstudio api-key create --name default\n" +
      "Then add to .env: EVALSTUDIO_API_KEY=<your-key>"
    );
    return null;
  }
  return API_KEY;
}

async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const apiKey = getApiKey();

  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");

  if (apiKey) {
    headers.set("X-API-Key", apiKey);
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // Handle auth errors
  if (response.status === 401) {
    throw new Error(
      "Authentication failed. Check that EVALSTUDIO_API_KEY is valid."
    );
  }

  return response;
}

// Update all API methods to use fetchWithAuth
export const api = {
  projects: {
    list: async (): Promise<Project[]> => {
      const response = await fetchWithAuth("/api/projects");
      return handleResponse(response);
    },
    // ... other methods use fetchWithAuth
  },
  // ... other namespaces
};
```

### Error Handling

When the API key is missing or invalid, display a clear error message:

```typescript
// packages/web/src/components/AuthError.tsx

export function AuthError({ error }: { error: Error }) {
  if (error.message.includes("Authentication failed")) {
    return (
      <div className="auth-error">
        <h2>Authentication Error</h2>
        <p>The API key is missing or invalid.</p>
        <ol>
          <li>Create a key: <code>evalstudio api-key create --name default</code></li>
          <li>Add to <code>.env</code>: <code>EVALSTUDIO_API_KEY=your-key</code></li>
          <li>Restart the dev server</li>
        </ol>
      </div>
    );
  }
  return <div className="error">{error.message}</div>;
}
```

---

## First-Time User Flow

### Complete Setup Sequence

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     FIRST-TIME USER JOURNEY                             │
└─────────────────────────────────────────────────────────────────────────┘

Step 1: Install EvalStudio
──────────────────────────
$ npm install -g evalstudio
$ npm install @evalstudio/api @evalstudio/web

Step 2: Create API Key (CLI)
────────────────────────────
$ evalstudio api-key create --name "default"

✓ API key created successfully!

┌─────────────────────────────────────────────────────────┐
│  IMPORTANT: Save this key now. It cannot be shown again │
└─────────────────────────────────────────────────────────┘

  Name:    default
  Key:     es_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6    ◀── Copy this
  Created: 2025-01-31T10:00:00.000Z

Step 3: Configure Web Package
─────────────────────────────
$ cd packages/web
$ echo "EVALSTUDIO_API_KEY=es_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6" >> .env

Or create/edit .env file:
┌─────────────────────────────────────────────────────────┐
│ # packages/web/.env                                     │
│ EVALSTUDIO_API_KEY=es_a1b2c3d4e5f6g7h8i9j0...     │
└─────────────────────────────────────────────────────────┘

Step 4: Start Services
──────────────────────
$ pnpm dev  # Starts both API server and web UI

API Server: http://localhost:3000
Web UI:     http://localhost:5173

Step 5: Authenticated Access
────────────────────────────
- Web automatically reads key from EVALSTUDIO_API_KEY
- All requests include X-API-Key header
- User has full access to EvalStudio

Step 6: Additional Keys (Optional)
──────────────────────────────────
$ evalstudio api-key create --name "ci-pipeline"
$ evalstudio api-key create --name "team-member-2"

Different keys for different purposes/users.
```

### Docker / Production Deployment

For containerized deployments, pass the API key as a build argument or runtime environment variable:

```dockerfile
# Dockerfile for web package
ARG EVALSTUDIO_API_KEY
ENV EVALSTUDIO_API_KEY=$EVALSTUDIO_API_KEY

# Build with key baked in
RUN npm run build
```

```bash
# Build command
docker build --build-arg EVALSTUDIO_API_KEY=es_xxx... -t evalstudio-web .
```

---

## Security Considerations

### Key Storage

| Location | Storage Method | Notes |
|----------|----------------|-------|
| Core (server) | SHA-256 hash | Plain text never stored |
| Web (build) | Environment variable | Baked into build via `EVALSTUDIO_API_KEY` |
| CLI | Not stored | Output once on creation |

### Best Practices

1. **Never log keys**: API server should never log the X-API-Key header value
2. **Use HTTPS in production**: Prevent key interception in transit
3. **Rotate keys periodically**: Use expiration dates for sensitive environments
4. **Separate keys per use case**: CI/CD, development, production
5. **Revoke compromised keys immediately**: `evalstudio api-key revoke <id>`

### Rate Limiting (Future)

Consider adding rate limiting per API key to prevent abuse:

```typescript
interface ApiKey {
  // ... existing fields
  rateLimitRpm?: number;  // Requests per minute (default: unlimited)
}
```

---

## Migration Path

For existing EvalStudio installations:

### Phase 1: Soft Launch (Optional Auth)

```typescript
// packages/api/src/middleware/auth.ts

const REQUIRE_AUTH = process.env.EVALSTUDIO_REQUIRE_AUTH !== "false";

export async function authMiddleware(request, reply) {
  if (!REQUIRE_AUTH) {
    return; // Skip auth if disabled
  }
  // ... existing auth logic
}
```

### Phase 2: Mandatory Auth

After users have had time to create API keys, make authentication mandatory.

---

## CLI Command Reference

```bash
# Create a new API key
evalstudio api-key create --name <name> [--expires <date>]

# List all API keys (shows metadata only)
evalstudio api-key list

# Revoke (delete) an API key
evalstudio api-key revoke <id>

# Examples
evalstudio api-key create --name "default"
evalstudio api-key create --name "ci-pipeline" --expires "2025-12-31"
evalstudio api-key list
evalstudio api-key revoke abc123-def456-...
```

---

## API Endpoint Reference

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/status` | Public | Health check |
| GET | `/api-keys` | Protected | List all keys (metadata) |
| DELETE | `/api-keys/:id` | Protected | Revoke a key |

---

## Summary

This design provides:

1. **Simple onboarding**: One CLI command to create a key, one env var to configure
2. **Secure storage**: Keys hashed server-side, never persisted in browser
3. **Transparent integration**: Web package auto-injects auth header from env var
4. **No UI complexity**: No setup pages or login flows - just environment configuration
5. **Deployment-friendly**: Works with Docker, CI/CD, and any environment that supports env vars
6. **Future-proof**: Supports key expiration, multiple keys, scopes