import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { resetStorageDir, setStorageDir } from "@evalstudio/core";
import { createServer } from "../index.js";

let testDir: string;

describe("projects routes", () => {
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
    const storagePath = join(testDir, "projects.json");
    if (existsSync(storagePath)) {
      rmSync(storagePath);
    }
  });

  afterEach(() => {
    const storagePath = join(testDir, "projects.json");
    if (existsSync(storagePath)) {
      rmSync(storagePath);
    }
  });

  describe("GET /projects", () => {
    it("returns empty array when no projects", async () => {
      const server = await createServer();

      const response = await server.inject({
        method: "GET",
        url: "/api/projects",
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual([]);

      await server.close();
    });

    it("returns all projects", async () => {
      const server = await createServer();

      await server.inject({
        method: "POST",
        url: "/api/projects",
        payload: { name: "project-1" },
      });

      await server.inject({
        method: "POST",
        url: "/api/projects",
        payload: { name: "project-2" },
      });

      const response = await server.inject({
        method: "GET",
        url: "/api/projects",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveLength(2);

      await server.close();
    });
  });

  describe("POST /projects", () => {
    it("creates a project", async () => {
      const server = await createServer();

      const response = await server.inject({
        method: "POST",
        url: "/api/projects",
        payload: { name: "test-project", description: "A test project" },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.name).toBe("test-project");
      expect(body.description).toBe("A test project");
      expect(body.id).toBeDefined();

      await server.close();
    });

    it("returns 400 for missing name", async () => {
      const server = await createServer();

      const response = await server.inject({
        method: "POST",
        url: "/api/projects",
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body)).toEqual({ error: "Name is required" });

      await server.close();
    });

    it("returns 409 for duplicate name", async () => {
      const server = await createServer();

      await server.inject({
        method: "POST",
        url: "/api/projects",
        payload: { name: "test-project" },
      });

      const response = await server.inject({
        method: "POST",
        url: "/api/projects",
        payload: { name: "test-project" },
      });

      expect(response.statusCode).toBe(409);

      await server.close();
    });
  });

  describe("GET /projects/:id", () => {
    it("returns project by id", async () => {
      const server = await createServer();

      const createResponse = await server.inject({
        method: "POST",
        url: "/api/projects",
        payload: { name: "test-project" },
      });
      const created = JSON.parse(createResponse.body);

      const response = await server.inject({
        method: "GET",
        url: `/api/projects/${created.id}`,
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual(created);

      await server.close();
    });

    it("returns 404 for non-existent id", async () => {
      const server = await createServer();

      const response = await server.inject({
        method: "GET",
        url: "/api/projects/non-existent",
      });

      expect(response.statusCode).toBe(404);

      await server.close();
    });
  });

  describe("PUT /projects/:id", () => {
    it("updates project", async () => {
      const server = await createServer();

      const createResponse = await server.inject({
        method: "POST",
        url: "/api/projects",
        payload: { name: "old-name" },
      });
      const created = JSON.parse(createResponse.body);

      const response = await server.inject({
        method: "PUT",
        url: `/api/projects/${created.id}`,
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
        url: "/api/projects/non-existent",
        payload: { name: "new-name" },
      });

      expect(response.statusCode).toBe(404);

      await server.close();
    });
  });

  describe("DELETE /projects/:id", () => {
    it("deletes project", async () => {
      const server = await createServer();

      const createResponse = await server.inject({
        method: "POST",
        url: "/api/projects",
        payload: { name: "test-project" },
      });
      const created = JSON.parse(createResponse.body);

      const response = await server.inject({
        method: "DELETE",
        url: `/api/projects/${created.id}`,
      });

      expect(response.statusCode).toBe(204);

      const getResponse = await server.inject({
        method: "GET",
        url: `/api/projects/${created.id}`,
      });

      expect(getResponse.statusCode).toBe(404);

      await server.close();
    });

    it("returns 404 for non-existent id", async () => {
      const server = await createServer();

      const response = await server.inject({
        method: "DELETE",
        url: "/api/projects/non-existent",
      });

      expect(response.statusCode).toBe(404);

      await server.close();
    });
  });
});
