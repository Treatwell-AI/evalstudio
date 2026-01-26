# EvalStudio - User Authentication

This document describes the architecture for user-based authentication to protect the EvalStudio API endpoints.

## Implementation Status

🔮 **Planned:**
- User entity in core package
- Session management with in-memory storage
- Login/logout endpoints
- Web UI login page and owner setup flow
- Admin panel for user management

---

## Overview

User-based authentication with session tokens. Users log in with email/password, receive a session token, and include it in subsequent requests. The first user (owner) is created via a setup UI on first web access.

## Design Goals

1. **User Identity**: Real user accounts, not anonymous API keys
2. **Session-Based**: Login once, use token for subsequent requests
3. **Simple Storage**: In-memory sessions (sufficient for local/small team use)
4. **Self-Service Setup**: First owner created via web UI, no CLI required
5. **Admin Panel**: Owner can manage users through the web interface

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
│              Session token validation                                   │
└─────────────────────────────────────────────────────────────────────────┘
```

**Why no CLI/core auth?**
- Developers already have filesystem access to `~/.evalstudio/*.json`
- Adding auth would be security theater - no actual protection gained
- Adds friction without meaningful security benefit
- Not what developers expect from local tools

**Why API auth?**
- Browser → API server crosses a network boundary
- Multiple users may access the same instance
- Enables user-specific audit trails

### Decision

**API-only auth** because:
1. Matches industry practice for local-first developer tools
2. Protects the actual trust boundary (network access)
3. Avoids unnecessary friction for local development
4. Aligns with developer expectations

---

## Package Impact Analysis

### ✅ Packages That WILL Be Modified

| Package | Changes Required |
|---------|------------------|
| **packages/core** | Add User entity, CRUD operations, password hashing |
| **packages/api** | Add auth middleware, session management, login/logout endpoints |
| **packages/web** | Add login page, owner setup page, token storage, admin panel |
| **packages/cli** | Add optional `user create` command for scripted setup |

### ❌ Packages That Will NOT Be Modified

| Package | Reason |
|---------|--------|
| **packages/docs** | Static documentation - no runtime authentication needed |

---

## Architecture

### Authentication Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     FIRST-TIME SETUP (NO USERS)                         │
│                                                                         │
│  1. User opens web UI                                                   │
│  2. API returns { setupRequired: true } from /auth/status               │
│  3. Web shows "Create Owner" form                                       │
│  4. User submits email + password                                       │
│  5. POST /auth/setup creates owner user + session                       │
│  6. Web stores token, redirects to dashboard                            │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                         NORMAL LOGIN FLOW                               │
│                                                                         │
│  1. User opens web UI                                                   │
│  2. Web checks for stored token, none found                             │
│  3. Web shows login form                                                │
│  4. User submits email + password                                       │
│  5. POST /auth/login validates credentials, creates session             │
│  6. API returns { token, user }                                         │
│  7. Web stores token in localStorage                                    │
│  8. Subsequent requests include Authorization: Bearer <token>           │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                         REQUEST AUTH FLOW                               │
│                                                                         │
│   Web Browser                    API Server                   Core      │
│   ──────────                     ──────────                   ────      │
│       │                              │                          │       │
│       │  GET /api/projects           │                          │       │
│       │  Authorization: Bearer xxx   │                          │       │
│       │─────────────────────────────▶│                          │       │
│       │                              │                          │       │
│       │                              │  sessions.get(token)     │       │
│       │                              │  ──▶ { userId, ... }     │       │
│       │                              │                          │       │
│       │                              │  listProjects()          │       │
│       │                              │─────────────────────────▶│       │
│       │                              │                          │       │
│       │  ◀─ 200 OK [projects...]     │                          │       │
│       │◀─────────────────────────────│                          │       │
└─────────────────────────────────────────────────────────────────────────┘
```

### Storage Structure

```
~/.evalstudio/
├── projects.json
├── scenarios.json
├── personas.json
├── evals.json
├── connectors.json
├── llm-providers.json
├── runs.json
└── users.json              ◀── NEW (persisted)

API Server (in-memory):
└── sessions: Map<token, Session>   ◀── NEW (volatile)
```

---

## Core Package Changes

### New Entity: User

```typescript
// packages/core/src/user.ts

export interface User {
  id: string;                    // UUID
  email: string;                 // Unique identifier for login
  passwordHash: string;          // bcrypt hash
  role: "owner" | "admin" | "user";
  createdAt: string;             // ISO timestamp
  lastLoginAt?: string;          // ISO timestamp
}

export interface UserCreateInput {
  email: string;
  password: string;              // Plain text, will be hashed
  role?: "admin" | "user";       // Owner role only for first user
}

export interface UserPublic {
  id: string;
  email: string;
  role: "owner" | "admin" | "user";
  createdAt: string;
  lastLoginAt?: string;
}
```

### Password Hashing

```typescript
// packages/core/src/user.ts

import { hash, compare } from "bcrypt";

const SALT_ROUNDS = 10;

export async function createUser(input: UserCreateInput): Promise<User> {
  const users = loadUsers();

  // Check for duplicate email
  if (users.some(u => u.email === input.email)) {
    throw new Error("User with this email already exists");
  }

  // First user is always owner
  const role = users.length === 0 ? "owner" : (input.role ?? "user");

  const passwordHash = await hash(input.password, SALT_ROUNDS);

  const user: User = {
    id: generateId(),
    email: input.email,
    passwordHash,
    role,
    createdAt: new Date().toISOString(),
  };

  users.push(user);
  saveUsers(users);

  return user;
}

export async function verifyPassword(user: User, password: string): Promise<boolean> {
  return compare(password, user.passwordHash);
}

export function getUserByEmail(email: string): User | undefined {
  return loadUsers().find(u => u.email === email);
}

export function listUsers(): User[] {
  return loadUsers();
}

export function hasUsers(): boolean {
  return loadUsers().length > 0;
}

export function toPublicUser(user: User): UserPublic {
  const { passwordHash, ...publicUser } = user;
  return publicUser;
}
```

### Export from Core

```typescript
// packages/core/src/index.ts

export {
  createUser,
  verifyPassword,
  getUserByEmail,
  listUsers,
  hasUsers,
  toPublicUser,
  type User,
  type UserCreateInput,
  type UserPublic,
} from "./user.js";
```

---

## API Package Changes

### Session Management (In-Memory)

```typescript
// packages/api/src/sessions.ts

import { randomBytes } from "crypto";

export interface Session {
  token: string;
  userId: string;
  userEmail: string;
  userRole: "owner" | "admin" | "user";
  createdAt: Date;
  expiresAt: Date;
}

// In-memory session storage
const sessions = new Map<string, Session>();

const TOKEN_LENGTH = 32;
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function createSession(user: { id: string; email: string; role: string }): Session {
  const token = randomBytes(TOKEN_LENGTH).toString("base64url");
  const now = new Date();

  const session: Session = {
    token,
    userId: user.id,
    userEmail: user.email,
    userRole: user.role as Session["userRole"],
    createdAt: now,
    expiresAt: new Date(now.getTime() + SESSION_DURATION_MS),
  };

  sessions.set(token, session);
  return session;
}

export function getSession(token: string): Session | null {
  const session = sessions.get(token);

  if (!session) {
    return null;
  }

  // Check expiration
  if (new Date() > session.expiresAt) {
    sessions.delete(token);
    return null;
  }

  return session;
}

export function deleteSession(token: string): boolean {
  return sessions.delete(token);
}

export function deleteUserSessions(userId: string): void {
  for (const [token, session] of sessions) {
    if (session.userId === userId) {
      sessions.delete(token);
    }
  }
}
```

### Authentication Middleware

```typescript
// packages/api/src/middleware/auth.ts

import { FastifyRequest, FastifyReply } from "fastify";
import { getSession, Session } from "../sessions.js";

const PUBLIC_ROUTES = [
  "/status",
  "/auth/status",
  "/auth/setup",
  "/auth/login",
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

  // Extract token from Authorization header
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    reply.code(401).send({
      error: "Unauthorized",
      message: "Missing or invalid Authorization header",
    });
    return;
  }

  const token = authHeader.slice(7); // Remove "Bearer "
  const session = getSession(token);

  if (!session) {
    reply.code(401).send({
      error: "Unauthorized",
      message: "Invalid or expired session",
    });
    return;
  }

  // Attach session to request
  request.session = session;
}

// Type augmentation
declare module "fastify" {
  interface FastifyRequest {
    session?: Session;
  }
}
```

### Auth Routes

```typescript
// packages/api/src/routes/auth.ts

import { FastifyInstance } from "fastify";
import {
  hasUsers,
  createUser,
  getUserByEmail,
  verifyPassword,
  toPublicUser,
} from "evalstudio";
import { createSession, deleteSession } from "../sessions.js";

export async function authRoutes(fastify: FastifyInstance): Promise<void> {

  // Check if setup is required (no users exist)
  fastify.get("/auth/status", async () => {
    return {
      setupRequired: !hasUsers(),
    };
  });

  // Create owner account (only works if no users exist)
  fastify.post("/auth/setup", async (request, reply) => {
    if (hasUsers()) {
      reply.code(400).send({
        error: "Setup already completed",
        message: "Owner account already exists. Use /auth/login instead.",
      });
      return;
    }

    const { email, password } = request.body as { email: string; password: string };

    if (!email || !password) {
      reply.code(400).send({ error: "Email and password required" });
      return;
    }

    if (password.length < 8) {
      reply.code(400).send({ error: "Password must be at least 8 characters" });
      return;
    }

    const user = await createUser({ email, password });
    const session = createSession(user);

    return {
      token: session.token,
      user: toPublicUser(user),
    };
  });

  // Login
  fastify.post("/auth/login", async (request, reply) => {
    const { email, password } = request.body as { email: string; password: string };

    if (!email || !password) {
      reply.code(400).send({ error: "Email and password required" });
      return;
    }

    const user = getUserByEmail(email);
    if (!user) {
      reply.code(401).send({ error: "Invalid credentials" });
      return;
    }

    const valid = await verifyPassword(user, password);
    if (!valid) {
      reply.code(401).send({ error: "Invalid credentials" });
      return;
    }

    const session = createSession(user);

    return {
      token: session.token,
      user: toPublicUser(user),
    };
  });

  // Logout
  fastify.post("/auth/logout", async (request, reply) => {
    const token = request.headers.authorization?.slice(7);
    if (token) {
      deleteSession(token);
    }
    reply.code(204).send();
  });

  // Get current user
  fastify.get("/auth/me", async (request, reply) => {
    if (!request.session) {
      reply.code(401).send({ error: "Not authenticated" });
      return;
    }

    const user = getUserByEmail(request.session.userEmail);
    if (!user) {
      reply.code(401).send({ error: "User not found" });
      return;
    }

    return toPublicUser(user);
  });
}
```

### User Management Routes (Admin Only)

```typescript
// packages/api/src/routes/users.ts

import { FastifyInstance } from "fastify";
import { createUser, listUsers, toPublicUser, deleteUser } from "evalstudio";

export async function usersRoutes(fastify: FastifyInstance): Promise<void> {

  // List all users (admin/owner only)
  fastify.get("/users", async (request, reply) => {
    if (!["owner", "admin"].includes(request.session?.userRole ?? "")) {
      reply.code(403).send({ error: "Admin access required" });
      return;
    }

    const users = listUsers();
    return users.map(toPublicUser);
  });

  // Create user (admin/owner only)
  fastify.post("/users", async (request, reply) => {
    if (!["owner", "admin"].includes(request.session?.userRole ?? "")) {
      reply.code(403).send({ error: "Admin access required" });
      return;
    }

    const { email, password, role } = request.body as {
      email: string;
      password: string;
      role?: "admin" | "user";
    };

    if (!email || !password) {
      reply.code(400).send({ error: "Email and password required" });
      return;
    }

    // Only owner can create admins
    if (role === "admin" && request.session?.userRole !== "owner") {
      reply.code(403).send({ error: "Only owner can create admin users" });
      return;
    }

    try {
      const user = await createUser({ email, password, role });
      reply.code(201).send(toPublicUser(user));
    } catch (error) {
      reply.code(400).send({ error: (error as Error).message });
    }
  });

  // Delete user (admin/owner only, can't delete owner)
  fastify.delete("/users/:id", async (request, reply) => {
    if (!["owner", "admin"].includes(request.session?.userRole ?? "")) {
      reply.code(403).send({ error: "Admin access required" });
      return;
    }

    const { id } = request.params as { id: string };

    // Prevent deleting owner
    const users = listUsers();
    const targetUser = users.find(u => u.id === id);

    if (!targetUser) {
      reply.code(404).send({ error: "User not found" });
      return;
    }

    if (targetUser.role === "owner") {
      reply.code(400).send({ error: "Cannot delete owner account" });
      return;
    }

    deleteUser(id);
    reply.code(204).send();
  });
}
```

---

## Web Package Changes

### Auth State Management

```typescript
// packages/web/src/lib/auth.ts

const TOKEN_KEY = "evalstudio_token";
const USER_KEY = "evalstudio_user";

export interface AuthUser {
  id: string;
  email: string;
  role: "owner" | "admin" | "user";
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  const data = localStorage.getItem(USER_KEY);
  return data ? JSON.parse(data) : null;
}

export function setAuth(token: string, user: AuthUser): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isAdmin(): boolean {
  const user = getStoredUser();
  return user?.role === "owner" || user?.role === "admin";
}
```

### API Client with Auth

```typescript
// packages/web/src/lib/api.ts

import { getStoredToken, clearAuth } from "./auth";

async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getStoredToken();

  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(url, { ...options, headers });

  // Handle auth errors - redirect to login
  if (response.status === 401) {
    clearAuth();
    window.location.href = "/login";
    throw new Error("Session expired");
  }

  return response;
}

export const api = {
  auth: {
    status: async () => {
      const res = await fetch("/api/auth/status");
      return res.json() as Promise<{ setupRequired: boolean }>;
    },
    setup: async (email: string, password: string) => {
      const res = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json() as Promise<{ token: string; user: AuthUser }>;
    },
    login: async (email: string, password: string) => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json() as Promise<{ token: string; user: AuthUser }>;
    },
    logout: async () => {
      await fetchWithAuth("/api/auth/logout", { method: "POST" });
      clearAuth();
    },
    me: async () => {
      const res = await fetchWithAuth("/api/auth/me");
      return res.json() as Promise<AuthUser>;
    },
  },

  users: {
    list: async () => {
      const res = await fetchWithAuth("/api/users");
      return res.json() as Promise<AuthUser[]>;
    },
    create: async (email: string, password: string, role?: "admin" | "user") => {
      const res = await fetchWithAuth("/api/users", {
        method: "POST",
        body: JSON.stringify({ email, password, role }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json() as Promise<AuthUser>;
    },
    delete: async (id: string) => {
      await fetchWithAuth(`/api/users/${id}`, { method: "DELETE" });
    },
  },

  // ... existing API methods use fetchWithAuth
  projects: {
    list: async () => {
      const res = await fetchWithAuth("/api/projects");
      return res.json();
    },
    // ...
  },
};
```

### Setup Page

```typescript
// packages/web/src/pages/SetupPage.tsx

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { setAuth } from "@/lib/auth";

export function SetupPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    try {
      const { token, user } = await api.auth.setup(email, password);
      setAuth(token, user);
      navigate("/");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="setup-page">
      <h1>Welcome to EvalStudio</h1>
      <p>Create your owner account to get started.</p>

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div>
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
        </div>

        <div>
          <label htmlFor="confirmPassword">Confirm Password</label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </div>

        {error && <p className="error">{error}</p>}

        <button type="submit" disabled={loading}>
          {loading ? "Creating..." : "Create Owner Account"}
        </button>
      </form>
    </div>
  );
}
```

### Login Page

```typescript
// packages/web/src/pages/LoginPage.tsx

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { setAuth } from "@/lib/auth";

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { token, user } = await api.auth.login(email, password);
      setAuth(token, user);
      navigate("/");
    } catch (err) {
      setError("Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <h1>EvalStudio</h1>

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div>
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {error && <p className="error">{error}</p>}

        <button type="submit" disabled={loading}>
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}
```

### App Router with Auth

```typescript
// packages/web/src/App.tsx

import { useEffect, useState } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { getStoredToken } from "@/lib/auth";
import { SetupPage } from "@/pages/SetupPage";
import { LoginPage } from "@/pages/LoginPage";
import { AppLayout } from "@/components/AppLayout";

function AuthGuard({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      // Check if setup is required
      const { setupRequired } = await api.auth.status();
      if (setupRequired) {
        navigate("/setup");
        return;
      }

      // Check if user has token
      const token = getStoredToken();
      if (!token) {
        navigate("/login");
        return;
      }

      setChecking(false);
    }

    checkAuth();
  }, [navigate]);

  if (checking) {
    return <div>Loading...</div>;
  }

  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      <Route path="/setup" element={<SetupPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <AuthGuard>
            <AppLayout />
          </AuthGuard>
        }
      />
    </Routes>
  );
}
```

---

## First-Time User Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     FIRST-TIME USER JOURNEY                             │
└─────────────────────────────────────────────────────────────────────────┘

Step 1: Start EvalStudio
────────────────────────
$ pnpm dev

API Server: http://localhost:3000
Web UI:     http://localhost:5173

Step 2: Open Web UI
───────────────────
Browser navigates to http://localhost:5173

┌───────────────────────────────────────────────────────────────┐
│                                                               │
│               Welcome to EvalStudio                           │
│                                                               │
│   Create your owner account to get started.                   │
│                                                               │
│   Email:     [admin@example.com____________]                  │
│   Password:  [••••••••____________________]                   │
│   Confirm:   [••••••••____________________]                   │
│                                                               │
│              [ Create Owner Account ]                         │
│                                                               │
└───────────────────────────────────────────────────────────────┘

Step 3: Owner Account Created
─────────────────────────────
- User is logged in automatically
- Redirected to dashboard
- Full access to all features

Step 4: Add Team Members (Optional)
───────────────────────────────────
Owner navigates to Settings → Users

┌───────────────────────────────────────────────────────────────┐
│  Users                                        [ + Add User ]  │
│───────────────────────────────────────────────────────────────│
│  admin@example.com          owner         Jan 31, 2025        │
└───────────────────────────────────────────────────────────────┘

Click "Add User" → create additional accounts
```

---

## Security Considerations

### Password Storage

| Location | Storage Method | Notes |
|----------|----------------|-------|
| Core (users.json) | bcrypt hash | Salt rounds: 10 |
| Web (localStorage) | Token only | No password stored |
| API (memory) | Session map | Cleared on restart |

### Session Security

1. **Token entropy**: 32 bytes (256 bits) from crypto.randomBytes
2. **Token format**: Base64URL encoded (URL-safe)
3. **Expiration**: 7 days (configurable)
4. **Revocation**: Logout deletes session immediately

### Best Practices

1. **Use HTTPS in production**: Prevent token interception
2. **Session timeout**: 7-day expiration, re-login required
3. **Password requirements**: Minimum 8 characters
4. **Owner protection**: Owner account cannot be deleted

---

## API Endpoint Reference

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/status` | Public | Health check |
| GET | `/auth/status` | Public | Check if setup required |
| POST | `/auth/setup` | Public* | Create owner (only if no users) |
| POST | `/auth/login` | Public | Login, returns token |
| POST | `/auth/logout` | Protected | Invalidate session |
| GET | `/auth/me` | Protected | Get current user |
| GET | `/users` | Admin | List all users |
| POST | `/users` | Admin | Create user |
| DELETE | `/users/:id` | Admin | Delete user (not owner) |

---

## CLI Commands (Optional)

For scripted/automated setup, the CLI can also create users:

```bash
# Create owner (only if no users exist)
evalstudio user create --email admin@example.com --password secret123

# Create additional user (requires EVALSTUDIO_ADMIN_TOKEN)
EVALSTUDIO_ADMIN_TOKEN=xxx evalstudio user create --email user@example.com --password secret123 --role user
```

This is optional - the primary flow is through the web UI.

---

## Summary

This design provides:

1. **User identity**: Real accounts with email/password
2. **Self-service setup**: First owner created via web UI
3. **Session management**: In-memory tokens, 7-day expiration
4. **Role-based access**: Owner > Admin > User hierarchy
5. **Admin panel**: Manage users through web interface
6. **No external dependencies**: bcrypt for passwords, in-memory sessions
