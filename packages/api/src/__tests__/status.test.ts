import { describe, it, expect, afterAll } from "vitest";
import { createServer } from "../index.js";

describe("GET /status", () => {
  it("returns status object", async () => {
    const server = await createServer();

    const response = await server.inject({
      method: "GET",
      url: "/api/status",
    });

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body);
    expect(body).toHaveProperty("name", "evalstudio");
    expect(body).toHaveProperty("version");
    expect(body.version).toMatch(/^\d+\.\d+\.\d+/); // semver format
    expect(body).toHaveProperty("status", "ok");
    expect(body).toHaveProperty("timestamp");
    expect(body).toHaveProperty("node");

    await server.close();
  });
});
