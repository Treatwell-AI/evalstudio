import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createConnector,
  deleteConnector,
  deleteConnectorsByProject,
  getConnector,
  getConnectorByName,
  getConnectorTypes,
  listConnectors,
  testConnector,
  updateConnector,
} from "../connector.js";
import { createProject } from "../project.js";
import { resetStorageDir, setStorageDir } from "../storage.js";

let testDir: string;

describe("connector", () => {
  let projectId: string;
  const testProjectName = `connector-test-project-${Date.now()}`;

  beforeAll(() => {
    testDir = mkdtempSync(join(tmpdir(), "evalstudio-test-"));
    setStorageDir(testDir);
    // Create a project for testing
    const project = createProject({ name: testProjectName });
    projectId = project.id;
  });

  afterAll(() => {
    resetStorageDir();
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  beforeEach(() => {
    // Clean connectors before each test
    const connectorsPath = join(testDir, "connectors.json");
    if (existsSync(connectorsPath)) {
      rmSync(connectorsPath);
    }
  });

  describe("createConnector", () => {
    it("creates a connector with required fields", () => {
      const connector = createConnector({
        projectId,
        name: "Test HTTP Connector",
        type: "http",
        baseUrl: "https://api.example.com",
      });

      expect(connector.id).toBeDefined();
      expect(connector.projectId).toBe(projectId);
      expect(connector.name).toBe("Test HTTP Connector");
      expect(connector.type).toBe("http");
      expect(connector.baseUrl).toBe("https://api.example.com");
      expect(connector.authType).toBeUndefined();
      expect(connector.authValue).toBeUndefined();
      expect(connector.config).toBeUndefined();
      expect(connector.createdAt).toBeDefined();
      expect(connector.updatedAt).toBeDefined();
    });

    it("creates a connector with all fields including auth and config", () => {
      const connector = createConnector({
        projectId,
        name: "LangGraph Dev API",
        type: "langgraph",
        baseUrl: "http://localhost:8123",
        authType: "api-key",
        authValue: "lg-dev-key-123",
        config: { assistantId: "my-assistant" },
      });

      expect(connector.name).toBe("LangGraph Dev API");
      expect(connector.type).toBe("langgraph");
      expect(connector.baseUrl).toBe("http://localhost:8123");
      expect(connector.authType).toBe("api-key");
      expect(connector.authValue).toBe("lg-dev-key-123");
      expect(connector.config).toEqual({ assistantId: "my-assistant" });
    });

    it("creates a connector with bearer auth", () => {
      const connector = createConnector({
        projectId,
        name: "Bearer Auth Connector",
        type: "http",
        baseUrl: "https://secure.api.com",
        authType: "bearer",
        authValue: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
      });

      expect(connector.authType).toBe("bearer");
      expect(connector.authValue).toBe("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");
    });

    it("throws error for non-existent project", () => {
      expect(() =>
        createConnector({
          projectId: "non-existent",
          name: "Test",
          type: "http",
          baseUrl: "https://api.example.com",
        })
      ).toThrow('Project with id "non-existent" not found');
    });

    it("throws error for duplicate name in same project", () => {
      createConnector({
        projectId,
        name: "Duplicate Name",
        type: "http",
        baseUrl: "https://api1.example.com",
      });

      expect(() =>
        createConnector({
          projectId,
          name: "Duplicate Name",
          type: "langgraph",
          baseUrl: "http://localhost:8123",
        })
      ).toThrow('Connector with name "Duplicate Name" already exists in this project');
    });

    it("allows same name in different projects", () => {
      const project2 = createProject({ name: `test-project-2-${Date.now()}` });

      const connector1 = createConnector({
        projectId,
        name: "Same Name",
        type: "http",
        baseUrl: "https://api1.example.com",
      });

      const connector2 = createConnector({
        projectId: project2.id,
        name: "Same Name",
        type: "langgraph",
        baseUrl: "http://localhost:8123",
      });

      expect(connector1.id).not.toBe(connector2.id);
      expect(connector1.name).toBe(connector2.name);
    });
  });

  describe("getConnector", () => {
    it("returns connector by id", () => {
      const created = createConnector({
        projectId,
        name: "Get Test",
        type: "http",
        baseUrl: "https://api.example.com",
      });

      const found = getConnector(created.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
      expect(found?.name).toBe("Get Test");
    });

    it("returns undefined for non-existent id", () => {
      const found = getConnector("non-existent-id");
      expect(found).toBeUndefined();
    });
  });

  describe("getConnectorByName", () => {
    it("returns connector by project and name", () => {
      createConnector({
        projectId,
        name: "Named Connector",
        type: "langgraph",
        baseUrl: "http://localhost:8123",
      });

      const found = getConnectorByName(projectId, "Named Connector");
      expect(found).toBeDefined();
      expect(found?.name).toBe("Named Connector");
    });

    it("returns undefined for non-existent name", () => {
      const found = getConnectorByName(projectId, "Non Existent");
      expect(found).toBeUndefined();
    });

    it("returns undefined for wrong project", () => {
      createConnector({
        projectId,
        name: "Project Specific",
        type: "http",
        baseUrl: "https://api.example.com",
      });

      const found = getConnectorByName("other-project-id", "Project Specific");
      expect(found).toBeUndefined();
    });
  });

  describe("listConnectors", () => {
    it("returns all connectors when no projectId specified", () => {
      const project2 = createProject({ name: `list-test-project-${Date.now()}` });

      createConnector({
        projectId,
        name: "Connector 1",
        type: "http",
        baseUrl: "https://api1.example.com",
      });
      createConnector({
        projectId: project2.id,
        name: "Connector 2",
        type: "langgraph",
        baseUrl: "http://localhost:8123",
      });

      const all = listConnectors();
      expect(all.length).toBeGreaterThanOrEqual(2);
    });

    it("returns only connectors for specified project", () => {
      const project2 = createProject({ name: `filter-test-project-${Date.now()}` });

      createConnector({
        projectId,
        name: "Main Project Connector",
        type: "http",
        baseUrl: "https://api.example.com",
      });
      createConnector({
        projectId: project2.id,
        name: "Other Project Connector",
        type: "langgraph",
        baseUrl: "http://localhost:8123",
      });

      const filtered = listConnectors(projectId);
      expect(filtered.every((c) => c.projectId === projectId)).toBe(true);
    });

    it("returns empty array for project with no connectors", () => {
      const emptyProject = createProject({ name: `empty-project-${Date.now()}` });
      const connectors = listConnectors(emptyProject.id);
      expect(connectors).toEqual([]);
    });
  });

  describe("updateConnector", () => {
    it("updates connector name", () => {
      const created = createConnector({
        projectId,
        name: "Original Name",
        type: "http",
        baseUrl: "https://api.example.com",
      });

      const updated = updateConnector(created.id, { name: "Updated Name" });
      expect(updated?.name).toBe("Updated Name");
      expect(updated?.updatedAt).toBeDefined();
      // Preserve other fields
      expect(updated?.type).toBe("http");
      expect(updated?.baseUrl).toBe("https://api.example.com");
    });

    it("updates connector type", () => {
      const created = createConnector({
        projectId,
        name: "Switch Type",
        type: "http",
        baseUrl: "https://api.example.com",
      });

      const updated = updateConnector(created.id, {
        type: "langgraph",
      });
      expect(updated?.type).toBe("langgraph");
    });

    it("updates base URL", () => {
      const created = createConnector({
        projectId,
        name: "URL Update",
        type: "http",
        baseUrl: "https://old.api.com",
      });

      const updated = updateConnector(created.id, { baseUrl: "https://new.api.com" });
      expect(updated?.baseUrl).toBe("https://new.api.com");
    });

    it("updates auth settings", () => {
      const created = createConnector({
        projectId,
        name: "Auth Update",
        type: "http",
        baseUrl: "https://api.example.com",
        authType: "none",
      });

      const updated = updateConnector(created.id, {
        authType: "api-key",
        authValue: "new-api-key",
      });
      expect(updated?.authType).toBe("api-key");
      expect(updated?.authValue).toBe("new-api-key");
    });

    it("updates config", () => {
      const created = createConnector({
        projectId,
        name: "Config Update",
        type: "langgraph",
        baseUrl: "http://localhost:8123",
        config: { assistantId: "initial" },
      });

      const updated = updateConnector(created.id, {
        config: { assistantId: "updated", metadata: { key: "value" } },
      });
      expect(updated?.config).toEqual({ assistantId: "updated", metadata: { key: "value" } });
    });

    it("returns undefined for non-existent connector", () => {
      const updated = updateConnector("non-existent", { name: "New Name" });
      expect(updated).toBeUndefined();
    });

    it("throws error for duplicate name on update", () => {
      createConnector({
        projectId,
        name: "Existing Name",
        type: "http",
        baseUrl: "https://api1.example.com",
      });

      const created = createConnector({
        projectId,
        name: "To Be Updated",
        type: "langgraph",
        baseUrl: "http://localhost:8123",
      });

      expect(() =>
        updateConnector(created.id, { name: "Existing Name" })
      ).toThrow('Connector with name "Existing Name" already exists in this project');
    });
  });

  describe("deleteConnector", () => {
    it("deletes connector and returns true", () => {
      const created = createConnector({
        projectId,
        name: "To Delete",
        type: "http",
        baseUrl: "https://api.example.com",
      });

      const result = deleteConnector(created.id);
      expect(result).toBe(true);

      const found = getConnector(created.id);
      expect(found).toBeUndefined();
    });

    it("returns false for non-existent connector", () => {
      const result = deleteConnector("non-existent-id");
      expect(result).toBe(false);
    });
  });

  describe("deleteConnectorsByProject", () => {
    it("deletes all connectors for a project", () => {
      const project = createProject({ name: `delete-all-test-${Date.now()}` });

      createConnector({
        projectId: project.id,
        name: "Connector 1",
        type: "http",
        baseUrl: "https://api1.example.com",
      });
      createConnector({
        projectId: project.id,
        name: "Connector 2",
        type: "langgraph",
        baseUrl: "http://localhost:8123",
      });

      const count = deleteConnectorsByProject(project.id);
      expect(count).toBe(2);

      const remaining = listConnectors(project.id);
      expect(remaining).toEqual([]);
    });

    it("returns 0 for project with no connectors", () => {
      const count = deleteConnectorsByProject("project-with-no-connectors");
      expect(count).toBe(0);
    });
  });

  describe("getConnectorTypes", () => {
    it("returns types for HTTP and LangGraph", () => {
      const types = getConnectorTypes();

      expect(types.http).toBeDefined();
      expect(types.http).toContain("HTTP");

      expect(types.langgraph).toBeDefined();
      expect(types.langgraph).toContain("LangGraph");
    });
  });

  describe("testConnector", () => {
    const mockFetch = vi.fn();

    beforeEach(() => {
      vi.stubGlobal("fetch", mockFetch);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      mockFetch.mockReset();
    });

    it("returns error for non-existent connector", async () => {
      const result = await testConnector("non-existent-id");

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
      expect(result.latencyMs).toBe(0);
    });

    it("tests HTTP connector successfully", async () => {
      const connector = createConnector({
        projectId,
        name: "Test HTTP",
        type: "http",
        baseUrl: "https://api.example.com",
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ response: "Hello back!" }),
      });

      const result = await testConnector(connector.id);

      expect(result.success).toBe(true);
      expect(result.response).toBe("Hello back!");
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.example.com",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })
      );
    });

    it("tests HTTP connector with api-key auth", async () => {
      const connector = createConnector({
        projectId,
        name: "Test HTTP Auth",
        type: "http",
        baseUrl: "https://api.example.com",
        authType: "api-key",
        authValue: "test-api-key",
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => "OK",
      });

      await testConnector(connector.id);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.example.com",
        expect.objectContaining({
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": "test-api-key",
          },
        })
      );
    });

    it("tests HTTP connector with bearer auth", async () => {
      const connector = createConnector({
        projectId,
        name: "Test HTTP Bearer",
        type: "http",
        baseUrl: "https://api.example.com",
        authType: "bearer",
        authValue: "test-token",
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => "OK",
      });

      await testConnector(connector.id);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.example.com",
        expect.objectContaining({
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer test-token",
          },
        })
      );
    });

    it("tests LangGraph connector successfully", async () => {
      const connector = createConnector({
        projectId,
        name: "Test LangGraph",
        type: "langgraph",
        baseUrl: "http://localhost:8123",
        config: { assistantId: "my-assistant" },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({ messages: [{ role: "assistant", content: "Hi there!" }] }),
      });

      const result = await testConnector(connector.id);

      expect(result.success).toBe(true);
      expect(result.response).toBe("Hi there!");
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8123/runs/wait",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("my-assistant"),
        })
      );
    });

    it("returns error on HTTP failure", async () => {
      const connector = createConnector({
        projectId,
        name: "Test HTTP Fail",
        type: "http",
        baseUrl: "https://api.example.com",
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => "Internal Server Error",
      });

      const result = await testConnector(connector.id);

      expect(result.success).toBe(false);
      expect(result.error).toContain("HTTP 500");
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it("returns error on network failure", async () => {
      const connector = createConnector({
        projectId,
        name: "Test Network Fail",
        type: "http",
        baseUrl: "https://api.example.com",
      });

      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await testConnector(connector.id);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network error");
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });
  });
});
