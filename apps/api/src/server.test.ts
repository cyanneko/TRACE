import { afterEach, describe, expect, it } from "vitest";

import { buildServer } from "./server.js";

const servers: ReturnType<typeof buildServer>[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("GET /health", () => {
  it("reports that the API is ready", async () => {
    const server = buildServer();
    servers.push(server);

    const response = await server.inject({
      method: "GET",
      url: "/health",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      service: "trace-api",
      status: "ok",
    });
  });
});
