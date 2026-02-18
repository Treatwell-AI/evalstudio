import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createConnectorModule, getConnectorTypes } from "../connector.js";
import type { ProjectContext } from "../project-resolver.js";

let tempDir: string;
let ctx: ProjectContext;
let mod: ReturnType<typeof createConnectorModule>;

describe("connector", () => {
  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "evalstudio-test-"));
    const dataDir = join(tempDir, "data");
    mkdirSync(dataDir, { recursive: true });
    ctx = {
      id: "test-project-id",
      name: "Test Project",
      dataDir,
      configPath: join(tempDir, "project.config.json"),
      workspaceDir: tempDir,
    };
    mod = createConnectorModule(ctx);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe("create", () => {
    it("creates a connector with required fields", () => {
      const connector = mod.create({
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
      const connector = mod.create({
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
      const connector = mod.create({
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
      mod.create({
        name: "Duplicate Name",
        type: "http",
        baseUrl: "https://api1.example.com",
      });

      expect(() =>
        mod.create({
          name: "Duplicate Name",
          type: "langgraph",
          baseUrl: "http://localhost:8123",
        })
      ).toThrow('Connector with name "Duplicate Name" already exists');
    });
  });

  describe("get", () => {
    it("returns connector by id", () => {
      const created = mod.create({
        name: "Get Test",
        type: "http",
        baseUrl: "https://api.example.com",
      });

      const found = mod.get(created.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
      expect(found?.name).toBe("Get Test");
    });

    it("returns undefined for non-existent id", () => {
      const found = mod.get("non-existent-id");
      expect(found).toBeUndefined();
    });
  });

  describe("getByName", () => {
    it("returns connector by name", () => {
      mod.create({
        name: "Named Connector",
        type: "langgraph",
        baseUrl: "http://localhost:8123",
      });

      const found = mod.getByName("Named Connector");
      expect(found).toBeDefined();
      expect(found?.name).toBe("Named Connector");
    });

    it("returns undefined for non-existent name", () => {
      const found = mod.getByName("Non Existent");
      expect(found).toBeUndefined();
    });
  });

  describe("list", () => {
    it("returns all connectors", () => {
      mod.create({
        name: "Connector 1",
        type: "http",
        baseUrl: "https://api1.example.com",
      });
      mod.create({
        name: "Connector 2",
        type: "langgraph",
        baseUrl: "http://localhost:8123",
      });

      const all = mod.list();
      expect(all).toHaveLength(2);
    });

    it("returns empty array when no connectors", () => {
      const connectors = mod.list();
      expect(connectors).toEqual([]);
    });
  });

  describe("update", () => {
    it("updates connector name", () => {
      const created = mod.create({
        name: "Original Name",
        type: "http",
        baseUrl: "https://api.example.com",
      });

      const updated = mod.update(created.id, { name: "Updated Name" });
      expect(updated?.name).toBe("Updated Name");
      expect(updated?.updatedAt).toBeDefined();
      // Preserve other fields
      expect(updated?.type).toBe("http");
      expect(updated?.baseUrl).toBe("https://api.example.com");
    });

    it("updates connector type", () => {
      const created = mod.create({
        name: "Switch Type",
        type: "http",
        baseUrl: "https://api.example.com",
      });

      const updated = mod.update(created.id, {
        type: "langgraph",
      });
      expect(updated?.type).toBe("langgraph");
    });

    it("updates base URL", () => {
      const created = mod.create({
        name: "URL Update",
        type: "http",
        baseUrl: "https://old.api.com",
      });

      const updated = mod.update(created.id, { baseUrl: "https://new.api.com" });
      expect(updated?.baseUrl).toBe("https://new.api.com");
    });

    it("updates config", () => {
      const created = mod.create({
        name: "Config Update",
        type: "langgraph",
        baseUrl: "http://localhost:8123",
        config: { assistantId: "initial" },
      });

      const updated = mod.update(created.id, {
        config: { assistantId: "updated" },
      });
      expect(updated?.config).toEqual({ assistantId: "updated" });
    });

    it("updates custom headers", () => {
      const created = mod.create({
        name: "Headers Update",
        type: "http",
        baseUrl: "https://api.example.com",
        headers: { "X-Old": "old-value" },
      });

      const updated = mod.update(created.id, {
        headers: { "X-New": "new-value" },
      });
      expect(updated?.headers).toEqual({ "X-New": "new-value" });
    });

    it("preserves headers when not provided in update", () => {
      const created = mod.create({
        name: "Headers Preserve",
        type: "http",
        baseUrl: "https://api.example.com",
        headers: { "X-Keep": "keep-value" },
      });

      const updated = mod.update(created.id, { name: "Renamed" });
      expect(updated?.headers).toEqual({ "X-Keep": "keep-value" });
    });

    it("returns undefined for non-existent connector", () => {
      const updated = mod.update("non-existent", { name: "New Name" });
      expect(updated).toBeUndefined();
    });

    it("throws error for duplicate name on update", () => {
      mod.create({
        name: "Existing Name",
        type: "http",
        baseUrl: "https://api1.example.com",
      });

      const created = mod.create({
        name: "To Be Updated",
        type: "langgraph",
        baseUrl: "http://localhost:8123",
      });

      expect(() =>
        mod.update(created.id, { name: "Existing Name" })
      ).toThrow('Connector with name "Existing Name" already exists');
    });
  });

  describe("delete", () => {
    it("deletes connector and returns true", () => {
      const created = mod.create({
        name: "To Delete",
        type: "http",
        baseUrl: "https://api.example.com",
      });

      const result = mod.delete(created.id);
      expect(result).toBe(true);

      const found = mod.get(created.id);
      expect(found).toBeUndefined();
    });

    it("returns false for non-existent connector", () => {
      const result = mod.delete("non-existent-id");
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

  describe("test", () => {
    const mockFetch = vi.fn();

    beforeEach(() => {
      vi.stubGlobal("fetch", mockFetch);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      mockFetch.mockReset();
    });

    it("returns error for non-existent connector", async () => {
      const result = await mod.test("non-existent-id");

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
      expect(result.latencyMs).toBe(0);
    });

    it("tests HTTP connector successfully", async () => {
      const connector = mod.create({
        name: "Test HTTP",
        type: "http",
        baseUrl: "https://api.example.com",
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ response: "Hello back!" }),
      });

      const result = await mod.test(connector.id);

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
      const connector = mod.create({
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

      const result = await mod.test(connector.id);

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
      const connector = mod.create({
        name: "Test HTTP Fail",
        type: "http",
        baseUrl: "https://api.example.com",
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => "Internal Server Error",
      });

      const result = await mod.test(connector.id);

      expect(result.success).toBe(false);
      expect(result.error).toContain("500");
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it("sends custom headers in test request", async () => {
      const connector = mod.create({
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

      await mod.test(connector.id);

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
      const connector = mod.create({
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

      await mod.test(connector.id);

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
      const connector = mod.create({
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

      await mod.test(connector.id);

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
      const connector = mod.create({
        name: "Test Network Fail",
        type: "http",
        baseUrl: "https://api.example.com",
      });

      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await mod.test(connector.id);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network error");
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });
  });
});
