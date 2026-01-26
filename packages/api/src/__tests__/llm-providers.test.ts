import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createProject, resetStorageDir, setStorageDir } from "evalstudio";
import { createServer } from "../index.js";

let testDir: string;
let projectId: string;

describe("llm-providers routes", () => {
  beforeAll(() => {
    testDir = mkdtempSync(join(tmpdir(), "evalstudio-test-"));
    setStorageDir(testDir);
    const project = createProject({ name: `test-project-${Date.now()}` });
    projectId = project.id;
  });

  afterAll(() => {
    resetStorageDir();
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  beforeEach(() => {
    const storagePath = join(testDir, "llm-providers.json");
    if (existsSync(storagePath)) {
      rmSync(storagePath);
    }
  });

  afterEach(() => {
    const storagePath = join(testDir, "llm-providers.json");
    if (existsSync(storagePath)) {
      rmSync(storagePath);
    }
  });

  describe("GET /llm-providers", () => {
    it("returns empty array when no providers", async () => {
      const server = await createServer();

      const response = await server.inject({
        method: "GET",
        url: "/api/llm-providers",
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual([]);

      await server.close();
    });

    it("returns all providers", async () => {
      const server = await createServer();

      await server.inject({
        method: "POST",
        url: "/api/llm-providers",
        payload: {
          projectId,
          name: "provider-1",
          provider: "openai",
          apiKey: "sk-test-1",
        },
      });

      await server.inject({
        method: "POST",
        url: "/api/llm-providers",
        payload: {
          projectId,
          name: "provider-2",
          provider: "anthropic",
          apiKey: "sk-ant-test",
        },
      });

      const response = await server.inject({
        method: "GET",
        url: "/api/llm-providers",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveLength(2);

      await server.close();
    });

    it("filters by projectId", async () => {
      const server = await createServer();
      const project2 = createProject({ name: `test-project-2-${Date.now()}` });

      await server.inject({
        method: "POST",
        url: "/api/llm-providers",
        payload: {
          projectId,
          name: "provider-1",
          provider: "openai",
          apiKey: "sk-test-1",
        },
      });

      await server.inject({
        method: "POST",
        url: "/api/llm-providers",
        payload: {
          projectId: project2.id,
          name: "provider-2",
          provider: "anthropic",
          apiKey: "sk-ant-test",
        },
      });

      const response = await server.inject({
        method: "GET",
        url: `/api/llm-providers?projectId=${projectId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveLength(1);
      expect(body[0].name).toBe("provider-1");

      await server.close();
    });
  });

  describe("GET /llm-providers/models", () => {
    it("returns available models for all providers", async () => {
      const server = await createServer();

      const response = await server.inject({
        method: "GET",
        url: "/api/llm-providers/models",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.openai).toBeDefined();
      expect(body.anthropic).toBeDefined();
      expect(body.openai).toContain("gpt-4o");
      expect(body.anthropic).toContain("claude-sonnet-4-20250514");

      await server.close();
    });
  });

  describe("POST /llm-providers", () => {
    it("creates a provider", async () => {
      const server = await createServer();

      const response = await server.inject({
        method: "POST",
        url: "/api/llm-providers",
        payload: {
          projectId,
          name: "test-provider",
          provider: "openai",
          apiKey: "sk-test-key",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.name).toBe("test-provider");
      expect(body.provider).toBe("openai");
      expect(body.apiKey).toBe("sk-test-key");
      expect(body.id).toBeDefined();

      await server.close();
    });

    it("returns 400 for missing projectId", async () => {
      const server = await createServer();

      const response = await server.inject({
        method: "POST",
        url: "/api/llm-providers",
        payload: {
          name: "test-provider",
          provider: "openai",
          apiKey: "sk-test-key",
        },
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body)).toEqual({ error: "Project ID is required" });

      await server.close();
    });

    it("returns 400 for missing name", async () => {
      const server = await createServer();

      const response = await server.inject({
        method: "POST",
        url: "/api/llm-providers",
        payload: {
          projectId,
          provider: "openai",
          apiKey: "sk-test-key",
        },
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body)).toEqual({ error: "Name is required" });

      await server.close();
    });

    it("returns 400 for missing provider", async () => {
      const server = await createServer();

      const response = await server.inject({
        method: "POST",
        url: "/api/llm-providers",
        payload: {
          projectId,
          name: "test-provider",
          apiKey: "sk-test-key",
        },
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body)).toEqual({ error: "Provider is required" });

      await server.close();
    });

    it("returns 400 for missing apiKey", async () => {
      const server = await createServer();

      const response = await server.inject({
        method: "POST",
        url: "/api/llm-providers",
        payload: {
          projectId,
          name: "test-provider",
          provider: "openai",
        },
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body)).toEqual({ error: "API key is required" });

      await server.close();
    });

    it("returns 404 for non-existent project", async () => {
      const server = await createServer();

      const response = await server.inject({
        method: "POST",
        url: "/api/llm-providers",
        payload: {
          projectId: "non-existent",
          name: "test-provider",
          provider: "openai",
          apiKey: "sk-test-key",
        },
      });

      expect(response.statusCode).toBe(404);

      await server.close();
    });

    it("returns 409 for duplicate name in same project", async () => {
      const server = await createServer();

      await server.inject({
        method: "POST",
        url: "/api/llm-providers",
        payload: {
          projectId,
          name: "duplicate-name",
          provider: "openai",
          apiKey: "sk-test-key",
        },
      });

      const response = await server.inject({
        method: "POST",
        url: "/api/llm-providers",
        payload: {
          projectId,
          name: "duplicate-name",
          provider: "anthropic",
          apiKey: "sk-ant-test",
        },
      });

      expect(response.statusCode).toBe(409);

      await server.close();
    });
  });

  describe("GET /llm-providers/:id", () => {
    it("returns provider by id", async () => {
      const server = await createServer();

      const createResponse = await server.inject({
        method: "POST",
        url: "/api/llm-providers",
        payload: {
          projectId,
          name: "test-provider",
          provider: "openai",
          apiKey: "sk-test-key",
        },
      });
      const created = JSON.parse(createResponse.body);

      const response = await server.inject({
        method: "GET",
        url: `/api/llm-providers/${created.id}`,
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual(created);

      await server.close();
    });

    it("returns 404 for non-existent id", async () => {
      const server = await createServer();

      const response = await server.inject({
        method: "GET",
        url: "/api/llm-providers/non-existent",
      });

      expect(response.statusCode).toBe(404);

      await server.close();
    });
  });

  describe("PUT /llm-providers/:id", () => {
    it("updates provider", async () => {
      const server = await createServer();

      const createResponse = await server.inject({
        method: "POST",
        url: "/api/llm-providers",
        payload: {
          projectId,
          name: "old-name",
          provider: "openai",
          apiKey: "sk-test-key",
        },
      });
      const created = JSON.parse(createResponse.body);

      const response = await server.inject({
        method: "PUT",
        url: `/api/llm-providers/${created.id}`,
        payload: { name: "new-name" },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.name).toBe("new-name");

      await server.close();
    });

    it("returns 404 for non-existent id", async () => {
      const server = await createServer();

      const response = await server.inject({
        method: "PUT",
        url: "/api/llm-providers/non-existent",
        payload: { name: "new-name" },
      });

      expect(response.statusCode).toBe(404);

      await server.close();
    });

    it("returns 409 for duplicate name on update", async () => {
      const server = await createServer();

      await server.inject({
        method: "POST",
        url: "/api/llm-providers",
        payload: {
          projectId,
          name: "existing-name",
          provider: "openai",
          apiKey: "sk-test-1",
        },
      });

      const createResponse = await server.inject({
        method: "POST",
        url: "/api/llm-providers",
        payload: {
          projectId,
          name: "to-be-updated",
          provider: "anthropic",
          apiKey: "sk-ant-test",
        },
      });
      const created = JSON.parse(createResponse.body);

      const response = await server.inject({
        method: "PUT",
        url: `/api/llm-providers/${created.id}`,
        payload: { name: "existing-name" },
      });

      expect(response.statusCode).toBe(409);

      await server.close();
    });
  });

  describe("DELETE /llm-providers/:id", () => {
    it("deletes provider", async () => {
      const server = await createServer();

      const createResponse = await server.inject({
        method: "POST",
        url: "/api/llm-providers",
        payload: {
          projectId,
          name: "test-provider",
          provider: "openai",
          apiKey: "sk-test-key",
        },
      });
      const created = JSON.parse(createResponse.body);

      const response = await server.inject({
        method: "DELETE",
        url: `/api/llm-providers/${created.id}`,
      });

      expect(response.statusCode).toBe(204);

      const getResponse = await server.inject({
        method: "GET",
        url: `/api/llm-providers/${created.id}`,
      });

      expect(getResponse.statusCode).toBe(404);

      await server.close();
    });

    it("returns 404 for non-existent id", async () => {
      const server = await createServer();

      const response = await server.inject({
        method: "DELETE",
        url: "/api/llm-providers/non-existent",
      });

      expect(response.statusCode).toBe(404);

      await server.close();
    });
  });
});
