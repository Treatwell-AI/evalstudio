import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { initWorkspace } from "@evalstudio/core";
import { createServer } from "../index.js";

let workspaceDir: string;
let projectId: string;
let prefix: string;

describe("evals routes", () => {
  let scenarioId: string;
  let scenario2Id: string;
  let connectorId: string;

  beforeAll(async () => {
    workspaceDir = mkdtempSync(join(tmpdir(), "evalstudio-test-"));
    const result = initWorkspace(workspaceDir, "test-workspace", "test-project");
    projectId = result.project.id;
    prefix = `/api/projects/${projectId}`;

    // Create scenarios and connector for testing
    const server = await createServer({ workspaceDir, runProcessor: false });

    const scenarioResponse = await server.inject({
      method: "POST",
      url: `${prefix}/scenarios`,
      payload: { name: "Test Scenario" },
    });
    scenarioId = JSON.parse(scenarioResponse.body).id;

    const scenario2Response = await server.inject({
      method: "POST",
      url: `${prefix}/scenarios`,
      payload: { name: "Test Scenario 2" },
    });
    scenario2Id = JSON.parse(scenario2Response.body).id;

    // Create connector (required for evals)
    const connectorResponse = await server.inject({
      method: "POST",
      url: `${prefix}/connectors`,
      payload: {
        name: "Test Connector",
        type: "http",
        baseUrl: "https://api.example.com",
      },
    });
    connectorId = JSON.parse(connectorResponse.body).id;

    await server.close();
  });

  afterAll(() => {
    if (existsSync(workspaceDir)) {
      rmSync(workspaceDir, { recursive: true });
    }
  });

  afterEach(async () => {
    const storagePath = join(workspaceDir, "projects", projectId, "data", "evals.json");
    if (existsSync(storagePath)) {
      rmSync(storagePath);
    }
  });

  describe("GET /evals", () => {
    it("returns empty array when no evals", async () => {
      const server = await createServer({ workspaceDir, runProcessor: false });

      const response = await server.inject({
        method: "GET",
        url: `${prefix}/evals`,
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual([]);

      await server.close();
    });

    it("returns all evals", async () => {
      const server = await createServer({ workspaceDir, runProcessor: false });

      await server.inject({
        method: "POST",
        url: `${prefix}/evals`,
        payload: { name: "Eval 1", connectorId, scenarioIds: [scenarioId] },
      });

      await server.inject({
        method: "POST",
        url: `${prefix}/evals`,
        payload: { name: "Eval 2", connectorId, scenarioIds: [scenario2Id] },
      });

      const response = await server.inject({
        method: "GET",
        url: `${prefix}/evals`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveLength(2);

      await server.close();
    });
  });

  describe("POST /evals", () => {
    it("creates an eval with required fields", async () => {
      const server = await createServer({ workspaceDir, runProcessor: false });

      const response = await server.inject({
        method: "POST",
        url: `${prefix}/evals`,
        payload: { name: "Test Eval", connectorId, scenarioIds: [scenarioId] },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.name).toBe("Test Eval");
      expect(body.connectorId).toBe(connectorId);
      expect(body.scenarioIds).toEqual([scenarioId]);
      expect(body.id).toBeDefined();

      await server.close();
    });

    it("returns 400 for missing name", async () => {
      const server = await createServer({ workspaceDir, runProcessor: false });

      const response = await server.inject({
        method: "POST",
        url: `${prefix}/evals`,
        payload: { connectorId, scenarioIds: [scenarioId] },
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body)).toEqual({ error: "Name is required" });

      await server.close();
    });

    it("returns 400 for missing scenario id", async () => {
      const server = await createServer({ workspaceDir, runProcessor: false });

      const response = await server.inject({
        method: "POST",
        url: `${prefix}/evals`,
        payload: { name: "Test", connectorId },
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body)).toEqual({ error: "At least one Scenario ID is required" });

      await server.close();
    });

    it("returns 400 for missing connector id", async () => {
      const server = await createServer({ workspaceDir, runProcessor: false });

      const response = await server.inject({
        method: "POST",
        url: `${prefix}/evals`,
        payload: { name: "Test", scenarioIds: [scenarioId] },
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body)).toEqual({ error: "Connector ID is required" });

      await server.close();
    });

    it("returns 404 for non-existent connector", async () => {
      const server = await createServer({ workspaceDir, runProcessor: false });

      const response = await server.inject({
        method: "POST",
        url: `${prefix}/evals`,
        payload: { name: "Test", connectorId: "non-existent", scenarioIds: [scenarioId] },
      });

      expect(response.statusCode).toBe(404);

      await server.close();
    });

    it("returns 404 for non-existent scenario", async () => {
      const server = await createServer({ workspaceDir, runProcessor: false });

      const response = await server.inject({
        method: "POST",
        url: `${prefix}/evals`,
        payload: { name: "Test", connectorId, scenarioIds: ["non-existent"] },
      });

      expect(response.statusCode).toBe(404);

      await server.close();
    });

    it("allows creating multiple evals with different scenarios", async () => {
      const server = await createServer({ workspaceDir, runProcessor: false });

      const response1 = await server.inject({
        method: "POST",
        url: `${prefix}/evals`,
        payload: { name: "Eval 1", connectorId, scenarioIds: [scenarioId] },
      });
      expect(response1.statusCode).toBe(201);

      const response2 = await server.inject({
        method: "POST",
        url: `${prefix}/evals`,
        payload: { name: "Eval 2", connectorId, scenarioIds: [scenario2Id] },
      });
      expect(response2.statusCode).toBe(201);

      await server.close();
    });
  });

  describe("GET /evals/:id", () => {
    it("returns eval by id", async () => {
      const server = await createServer({ workspaceDir, runProcessor: false });

      const createResponse = await server.inject({
        method: "POST",
        url: `${prefix}/evals`,
        payload: { name: "Test Eval", connectorId, scenarioIds: [scenarioId] },
      });
      const created = JSON.parse(createResponse.body);

      const response = await server.inject({
        method: "GET",
        url: `${prefix}/evals/${created.id}`,
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual(created);

      await server.close();
    });

    it("returns eval with relations when expand=true", async () => {
      const server = await createServer({ workspaceDir, runProcessor: false });

      const createResponse = await server.inject({
        method: "POST",
        url: `${prefix}/evals`,
        payload: { name: "Test Eval", connectorId, scenarioIds: [scenarioId] },
      });
      const created = JSON.parse(createResponse.body);

      const response = await server.inject({
        method: "GET",
        url: `${prefix}/evals/${created.id}?expand=true`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.scenarios).toBeDefined();
      expect(body.scenarios).toHaveLength(1);
      expect(body.scenarios[0].id).toBe(scenarioId);

      await server.close();
    });

    it("returns 404 for non-existent id", async () => {
      const server = await createServer({ workspaceDir, runProcessor: false });

      const response = await server.inject({
        method: "GET",
        url: `${prefix}/evals/non-existent`,
      });

      expect(response.statusCode).toBe(404);

      await server.close();
    });
  });

  describe("PUT /evals/:id", () => {
    it("updates eval name", async () => {
      const server = await createServer({ workspaceDir, runProcessor: false });

      const createResponse = await server.inject({
        method: "POST",
        url: `${prefix}/evals`,
        payload: { name: "Original Name", connectorId, scenarioIds: [scenarioId] },
      });
      const created = JSON.parse(createResponse.body);

      const response = await server.inject({
        method: "PUT",
        url: `${prefix}/evals/${created.id}`,
        payload: { name: "Updated Name" },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.name).toBe("Updated Name");

      await server.close();
    });

    it("updates eval scenario", async () => {
      const server = await createServer({ workspaceDir, runProcessor: false });

      const createResponse = await server.inject({
        method: "POST",
        url: `${prefix}/evals`,
        payload: { name: "Test Eval", connectorId, scenarioIds: [scenarioId] },
      });
      const created = JSON.parse(createResponse.body);

      const response = await server.inject({
        method: "PUT",
        url: `${prefix}/evals/${created.id}`,
        payload: { scenarioIds: [scenario2Id] },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.scenarioIds).toEqual([scenario2Id]);

      await server.close();
    });

    it("returns 404 for non-existent id", async () => {
      const server = await createServer({ workspaceDir, runProcessor: false });

      const response = await server.inject({
        method: "PUT",
        url: `${prefix}/evals/non-existent`,
        payload: { name: "new" },
      });

      expect(response.statusCode).toBe(404);

      await server.close();
    });
  });

  describe("DELETE /evals/:id", () => {
    it("deletes eval", async () => {
      const server = await createServer({ workspaceDir, runProcessor: false });

      const createResponse = await server.inject({
        method: "POST",
        url: `${prefix}/evals`,
        payload: { name: "Test Eval", connectorId, scenarioIds: [scenarioId] },
      });
      const created = JSON.parse(createResponse.body);

      const response = await server.inject({
        method: "DELETE",
        url: `${prefix}/evals/${created.id}`,
      });

      expect(response.statusCode).toBe(204);

      const getResponse = await server.inject({
        method: "GET",
        url: `${prefix}/evals/${created.id}`,
      });

      expect(getResponse.statusCode).toBe(404);

      await server.close();
    });

    it("returns 404 for non-existent id", async () => {
      const server = await createServer({ workspaceDir, runProcessor: false });

      const response = await server.inject({
        method: "DELETE",
        url: `${prefix}/evals/non-existent`,
      });

      expect(response.statusCode).toBe(404);

      await server.close();
    });
  });
});
