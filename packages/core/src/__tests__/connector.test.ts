import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createConnector,
  deleteConnector,
  getConnector,
  getConnectorByName,
  getConnectorTypes,
  listConnectors,
  testConnector,
  updateConnector,
} from "../connector.js";
import { resetStorageDir, setStorageDir } from "../storage.js";

let testDir: string;

describe("connector", () => {
  beforeAll(() => {
    testDir = mkdtempSync(join(tmpdir(), "evalstudio-test-"));
    setStorageDir(testDir);
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
        name: "Test HTTP Connector",
        type: "http",
        baseUrl: "https://api.example.com",
      });

      expect(connector.id).toBeDefined();
      expect(connector.name).toBe("Test HTTP Connector");
      expect(connector.type).toBe("http");
      expect(connector.baseUrl).toBe("https://api.example.com");
      expect(connector.config).toBeUndefined();
      expect(connector.createdAt).toBeDefined();
      expect(connector.updatedAt).toBeDefined();
    });

    it("creates a connector with all fields including headers and config", () => {
      const connector = createConnector({
        name: "LangGraph Dev API",
        type: "langgraph",
        baseUrl: "http://localhost:8123",
        headers: { "X-API-Key": "lg-dev-key-123" },
        config: { assistantId: "my-assistant" },
      });

      expect(connector.name).toBe("LangGraph Dev API");
      expect(connector.type).toBe("langgraph");
      expect(connector.baseUrl).toBe("http://localhost:8123");
      expect(connector.headers).toEqual({ "X-API-Key": "lg-dev-key-123" });
      expect(connector.config).toEqual({ assistantId: "my-assistant" });
    });

    it("creates a connector with custom headers", () => {
      const connector = createConnector({
        name: "Custom Headers Connector",
        type: "http",
        baseUrl: "https://api.example.com",
        headers: {
          "X-Custom-Header": "custom-value",
          "X-Tenant-Id": "tenant-123",
        },
      });

      expect(connector.headers).toEqual({
        "X-Custom-Header": "custom-value",
        "X-Tenant-Id": "tenant-123",
      });
    });

    it("throws error for duplicate name", () => {
      createConnector({
        name: "Duplicate Name",
        type: "http",
        baseUrl: "https://api1.example.com",
      });

      expect(() =>
        createConnector({
          name: "Duplicate Name",
          type: "langgraph",
          baseUrl: "http://localhost:8123",
        })
      ).toThrow('Connector with name "Duplicate Name" already exists');
    });
  });

  describe("getConnector", () => {
    it("returns connector by id", () => {
      const created = createConnector({
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
    it("returns connector by name", () => {
      createConnector({
        name: "Named Connector",
        type: "langgraph",
        baseUrl: "http://localhost:8123",
      });

      const found = getConnectorByName("Named Connector");
      expect(found).toBeDefined();
      expect(found?.name).toBe("Named Connector");
    });

    it("returns undefined for non-existent name", () => {
      const found = getConnectorByName("Non Existent");
      expect(found).toBeUndefined();
    });
  });

  describe("listConnectors", () => {
    it("returns all connectors", () => {
      createConnector({
        name: "Connector 1",
        type: "http",
        baseUrl: "https://api1.example.com",
      });
      createConnector({
        name: "Connector 2",
        type: "langgraph",
        baseUrl: "http://localhost:8123",
      });

      const all = listConnectors();
      expect(all).toHaveLength(2);
    });

    it("returns empty array when no connectors", () => {
      const connectors = listConnectors();
      expect(connectors).toEqual([]);
    });
  });

  describe("updateConnector", () => {
    it("updates connector name", () => {
      const created = createConnector({
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
        name: "URL Update",
        type: "http",
        baseUrl: "https://old.api.com",
      });

      const updated = updateConnector(created.id, { baseUrl: "https://new.api.com" });
      expect(updated?.baseUrl).toBe("https://new.api.com");
    });

    it("updates config", () => {
      const created = createConnector({
        name: "Config Update",
        type: "langgraph",
        baseUrl: "http://localhost:8123",
        config: { assistantId: "initial" },
      });

      const updated = updateConnector(created.id, {
        config: { assistantId: "updated" },
      });
      expect(updated?.config).toEqual({ assistantId: "updated" });
    });

    it("updates custom headers", () => {
      const created = createConnector({
        name: "Headers Update",
        type: "http",
        baseUrl: "https://api.example.com",
        headers: { "X-Old": "old-value" },
      });

      const updated = updateConnector(created.id, {
        headers: { "X-New": "new-value" },
      });
      expect(updated?.headers).toEqual({ "X-New": "new-value" });
    });

    it("preserves headers when not provided in update", () => {
      const created = createConnector({
        name: "Headers Preserve",
        type: "http",
        baseUrl: "https://api.example.com",
        headers: { "X-Keep": "keep-value" },
      });

      const updated = updateConnector(created.id, { name: "Renamed" });
      expect(updated?.headers).toEqual({ "X-Keep": "keep-value" });
    });

    it("returns undefined for non-existent connector", () => {
      const updated = updateConnector("non-existent", { name: "New Name" });
      expect(updated).toBeUndefined();
    });

    it("throws error for duplicate name on update", () => {
      createConnector({
        name: "Existing Name",
        type: "http",
        baseUrl: "https://api1.example.com",
      });

      const created = createConnector({
        name: "To Be Updated",
        type: "langgraph",
        baseUrl: "http://localhost:8123",
      });

      expect(() =>
        updateConnector(created.id, { name: "Existing Name" })
      ).toThrow('Connector with name "Existing Name" already exists');
    });
  });

  describe("deleteConnector", () => {
    it("deletes connector and returns true", () => {
      const created = createConnector({
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

    it("tests LangGraph connector successfully", async () => {
      const connector = createConnector({
        name: "Test LangGraph",
        type: "langgraph",
        baseUrl: "http://localhost:8123",
        config: { assistantId: "my-assistant" },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({ version: "0.1.0" }),
      });

      const result = await testConnector(connector.id);

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8123/info",
        expect.objectContaining({
          method: "GET",
          headers: { "Content-Type": "application/json" },
        })
      );
    });

    it("returns error on HTTP failure", async () => {
      const connector = createConnector({
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
      expect(result.error).toContain("500");
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it("sends custom headers in test request", async () => {
      const connector = createConnector({
        name: "Test Custom Headers",
        type: "http",
        baseUrl: "https://api.example.com",
        headers: {
          "X-Custom": "custom-value",
          "X-Tenant-Id": "tenant-123",
        },
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
            "X-Custom": "custom-value",
            "X-Tenant-Id": "tenant-123",
          },
        })
      );
    });

    it("custom headers override default Content-Type", async () => {
      const connector = createConnector({
        name: "Test Override Headers",
        type: "http",
        baseUrl: "https://api.example.com",
        headers: {
          "Content-Type": "text/plain",
          Authorization: "Bearer my-token",
        },
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
            "Content-Type": "text/plain",
            Authorization: "Bearer my-token",
          },
        })
      );
    });

    it("sends custom headers for LangGraph connector", async () => {
      const connector = createConnector({
        name: "Test LG Headers",
        type: "langgraph",
        baseUrl: "http://localhost:8123",
        config: { assistantId: "my-assistant" },
        headers: { "X-Custom": "lg-value" },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ messages: [] }),
      });

      await testConnector(connector.id);

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8123/info",
        expect.objectContaining({
          headers: {
            "Content-Type": "application/json",
            "X-Custom": "lg-value",
          },
        })
      );
    });

    it("returns error on network failure", async () => {
      const connector = createConnector({
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
