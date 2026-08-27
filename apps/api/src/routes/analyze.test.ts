import { afterEach, describe, expect, it } from "vitest";

import { FixtureProvider } from "../providers/fixtureProvider.js";
import type { ModelProvider } from "../providers/modelProvider.js";
import { ModelOutputTruncatedError, ModelProviderTimeoutError } from "../providers/modelProviderErrors.js";
import { ModelOutputError } from "../providers/parseModelOutput.js";
import { buildServer } from "../server.js";

const onePixelPng =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

const servers: ReturnType<typeof buildServer>[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

function createServer() {
  const server = buildServer({ provider: new FixtureProvider() });
  servers.push(server);
  return server;
}

function createFailingServer(error: Error) {
  const provider: ModelProvider = {
    info: { fixture: false, id: "test-provider", model: "vision-test" },
    analyze: async () => Promise.reject(error),
    generateInsights: async () => Promise.reject(error),
  };
  const server = buildServer({ provider });
  servers.push(server);
  return server;
}

const validPayload = {
  screenshotDataUrl: onePixelPng,
  contacts: [],
  memories: [],
  timezone: "Asia/Shanghai",
  currentTime: "2026-08-26T03:30:00.000Z",
};

describe("POST /v1/analyze", () => {
  it("returns a validated meeting proposal", async () => {
    const response = await createServer().inject({
      method: "POST",
      url: "/v1/analyze",
      payload: {
        screenshotDataUrl: onePixelPng,
        note: "Maya is in my contacts.",
        contacts: [],
        memories: [],
        timezone: "Asia/Shanghai",
        currentTime: "2026-08-26T03:30:00.000Z",
        fixtureId: "meeting",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      provider: {
        fixture: true,
        id: "fixture",
      },
      actionCards: [
        {
          type: "create_meeting",
        },
      ],
    });
  });

  it("does not invent an action for a no-action fixture", async () => {
    const response = await createServer().inject({
      method: "POST",
      url: "/v1/analyze",
      payload: {
        screenshotDataUrl: onePixelPng,
        contacts: [],
        memories: [],
        timezone: "Asia/Shanghai",
        currentTime: "2026-08-26T03:30:00.000Z",
        fixtureId: "no-action",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().actionCards).toEqual([]);
  });

  it("returns every card when a fixture contains more than three actions", async () => {
    const response = await createServer().inject({
      method: "POST",
      url: "/v1/analyze",
      payload: {
        ...validPayload,
        fixtureId: "many-actions",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().actionCards).toHaveLength(4);
  });

  it("returns a validated meeting update", async () => {
    const response = await createServer().inject({
      method: "POST",
      url: "/v1/analyze",
      payload: {
        ...validPayload,
        fixtureId: "update-meeting",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().actionCards[0]).toMatchObject({ type: "update_meeting" });
  });

  it("accepts a description-only request with dependent contact and meeting actions", async () => {
    const response = await createServer().inject({
      method: "POST",
      url: "/v1/analyze",
      payload: {
        ...validPayload,
        fixtureId: "contact-meeting",
        note: "林乔希望明天下午三点聊合作。",
        screenshotDataUrl: undefined,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().actionCards.map((card: { type: string }) => card.type)).toEqual([
      "create_meeting",
      "create_contact",
    ]);
  });

  it("returns contacts and meetings in separate planning passes", async () => {
    const server = createServer();
    const input = {
      ...validPayload,
      fixtureId: "contact-meeting",
      note: "林乔希望明天下午三点聊合作。",
      screenshotDataUrl: undefined,
    };
    const contacts = await server.inject({
      method: "POST",
      url: "/v1/analyze",
      payload: { ...input, actionScope: "contacts" },
    });
    const meetings = await server.inject({
      method: "POST",
      url: "/v1/analyze",
      payload: { ...input, actionScope: "meetings" },
    });

    expect(contacts.statusCode).toBe(200);
    expect(contacts.json().actionCards.map((card: { type: string }) => card.type)).toEqual([
      "create_contact",
    ]);
    expect(meetings.statusCode).toBe(200);
    expect(meetings.json().actionCards.map((card: { type: string }) => card.type)).toEqual([
      "create_meeting",
    ]);
  });

  it("returns an explicit self contact when the user must join a meeting", async () => {
    const response = await createServer().inject({
      method: "POST",
      url: "/v1/analyze",
      payload: {
        ...validPayload,
        fixtureId: "self-meeting",
        note: "I am Kai. Add Lina HR and me to tomorrow's interview.",
        screenshotDataUrl: undefined,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().actionCards).toContainEqual(
      expect.objectContaining({
        type: "create_contact",
        payload: expect.objectContaining({ displayName: "Kai", isSelf: true }),
      }),
    );
  });

  it("rejects a request without a screenshot or description", async () => {
    const response = await createServer().inject({
      method: "POST",
      url: "/v1/analyze",
      payload: {
        ...validPayload,
        screenshotDataUrl: undefined,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("INVALID_ANALYZE_REQUEST");
  });

  it("uses a user-selected fixture without returning supplied credentials", async () => {
    const response = await createServer().inject({
      method: "POST",
      url: "/v1/analyze",
      payload: {
        screenshotDataUrl: onePixelPng,
        contacts: [],
        memories: [],
        timezone: "Asia/Shanghai",
        currentTime: "2026-08-26T03:30:00.000Z",
        fixtureId: "meeting",
        visionProvider: {
          provider: "fixture",
          apiKey: "must-not-leak",
        },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().provider).toMatchObject({ fixture: true, id: "fixture" });
    expect(response.body).not.toContain("must-not-leak");
  });

  it("rejects unsupported screenshot content", async () => {
    const response = await createServer().inject({
      method: "POST",
      url: "/v1/analyze",
      payload: {
        screenshotDataUrl: "data:text/plain;base64,aGVsbG8=",
        contacts: [],
        memories: [],
        timezone: "Asia/Shanghai",
        currentTime: "2026-08-26T03:30:00.000Z",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("INVALID_ANALYZE_REQUEST");
  });

  it.each([
    {
      code: "MODEL_PROVIDER_TIMEOUT",
      error: new ModelProviderTimeoutError(),
      statusCode: 504,
    },
    {
      code: "MODEL_OUTPUT_TRUNCATED",
      error: new ModelOutputTruncatedError(8192),
      statusCode: 502,
    },
  ])("returns a specific $code response", async ({ code, error, statusCode }) => {
    const response = await createFailingServer(error).inject({
      method: "POST",
      url: "/v1/analyze",
      payload: validPayload,
    });

    expect(response.statusCode).toBe(statusCode);
    expect(response.json().error.code).toBe(code);
  });

  it("returns safe validation paths for an invalid model response", async () => {
    const response = await createFailingServer(
      new ModelOutputError("invalid output", [
        { path: "actionCards.0.payload.startAt", message: "Invalid ISO datetime" },
      ]),
    ).inject({
      method: "POST",
      url: "/v1/analyze",
      payload: validPayload,
    });

    expect(response.statusCode).toBe(502);
    expect(response.json().error).toMatchObject({
      code: "INVALID_MODEL_OUTPUT",
      issues: [{ path: "actionCards.0.payload.startAt", message: "Invalid ISO datetime" }],
    });
    expect(response.json().error.message).toContain("actionCards.0.payload.startAt");
  });
});
