import {
  USER_NOTE_EVIDENCE_ID,
  type AnalyzeRequest,
  type InsightRequest,
} from "@trace/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { VisionProviderConfig } from "../config.js";
import { getAnalyzeFixture } from "../fixtures/analyzeFixtures.js";
import { ModelOutputTruncatedError, ModelProviderTimeoutError } from "./modelProviderErrors.js";
import { OpenAICompatibleVisionProvider } from "./openAICompatibleVisionProvider.js";

const input: AnalyzeRequest = {
  actionScope: "all",
  contacts: [],
  currentTime: "2026-08-26T03:30:00.000Z",
  entityMemories: [],
  meetings: [],
  note: "",
  reviewFeedback: "",
  screenshotDataUrl:
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  timezone: "Asia/Shanghai",
};

const config: VisionProviderConfig = {
  apiKey: "test-key",
  baseURL: "https://api.deepseek.test",
  id: "deepseek",
  imageDetail: "high",
  imageFormat: "data-url",
  jsonMode: true,
  model: "deepseek-v4-flash-vision-exp",
  thinking: "disabled",
};

function insightInput(): InsightRequest {
  const fixture = getAnalyzeFixture("meeting");
  const action = fixture.actionCards[0]!;
  return {
    sourceRunId: "10000000-0000-4000-8000-000000000001",
    screenshotDataUrl: input.screenshotDataUrl,
    note: "The user prefers a concise follow-up.",
    thread: fixture.thread,
    confirmedActions: [action],
    toolResults: [{ actionId: action.id, success: true, provider: "demo" }],
    entityMemories: [],
    contacts: [],
    meetings: [],
    timezone: "Asia/Shanghai",
    currentTime: "2026-08-26T03:30:00.000Z",
  };
}

function completionResponse(content: string, finishReason = "stop") {
  return new Response(
    JSON.stringify({
      choices: [
        {
          finish_reason: finishReason,
          index: 0,
          message: { content, role: "assistant" },
        },
      ],
      created: 1,
      id: "completion-test",
      model: config.model,
      object: "chat.completion",
      usage: { completion_tokens: 8192, prompt_tokens: 100, total_tokens: 8292 },
    }),
    { headers: { "content-type": "application/json" }, status: 200 },
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("OpenAICompatibleVisionProvider", () => {
  it("sends DeepSeek's non-thinking JSON request", async () => {
    let requestBody: Record<string, unknown> | undefined;
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return completionResponse(JSON.stringify(getAnalyzeFixture("no-action")));
    });
    vi.stubGlobal("fetch", fetchMock);

    await new OpenAICompatibleVisionProvider(config).analyze(input);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(requestBody).toMatchObject({
      max_tokens: 8192,
      model: "deepseek-v4-flash-vision-exp",
      response_format: { type: "json_object" },
      thinking: { type: "disabled" },
    });
  });

  it("sends a text-only request without an image content part", async () => {
    let requestBody: {
      messages?: Array<{ content?: Array<{ type?: string }> }>;
    } = {};
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      requestBody = JSON.parse(String(init?.body)) as typeof requestBody;
      return completionResponse(JSON.stringify(getAnalyzeFixture("no-action")));
    });
    vi.stubGlobal("fetch", fetchMock);

    await new OpenAICompatibleVisionProvider(config).analyze({
      ...input,
      note: "Maya said hello, but no action is needed.",
      screenshotDataUrl: undefined,
    });

    expect(requestBody.messages?.[1]?.content?.map((part) => part.type)).toEqual(["text"]);
  });

  it("sends the original image and full context for model-generated insights", async () => {
    const insight = insightInput();
    const evidenceId = insight.thread.evidence[0]!.id;
    let requestBody: {
      messages?: Array<{ content?: string | Array<{ type?: string; text?: string }> }>;
    } = {};
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      requestBody = JSON.parse(String(init?.body)) as typeof requestBody;
      return completionResponse(
        JSON.stringify({
          insights: [
            {
              title: "Keep the follow-up concise",
              body: "The current thread supports a short written follow-up.",
              importance: "medium",
              evidenceRefs: [evidenceId],
              memoryRefs: [],
            },
          ],
          unresolvedQuestions: [],
          globalMemoryOperations: [
            {
              type: "create",
              content: "Prefer concise written follow-ups.",
              evidenceRefs: [evidenceId],
              confidence: 0.9,
            },
          ],
        }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await new OpenAICompatibleVisionProvider(config).generateInsights(insight);
    const userContent = requestBody.messages?.[1]?.content;

    expect(Array.isArray(userContent) ? userContent.map((part) => part.type) : []).toEqual([
      "text",
      "image_url",
    ]);
    expect(Array.isArray(userContent) ? userContent[0]?.text : "").toContain(
      "The user prefers a concise follow-up",
    );
    expect(result.globalMemoryOperations[0]?.type).toBe("create");
  });

  it("repairs a silently ignored direct Global Memory instruction", async () => {
    let completion = 0;
    const prompts: string[] = [];
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const requestBody = JSON.parse(String(init?.body)) as {
        messages?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
      };
      const userContent = requestBody.messages?.[1]?.content;
      prompts.push(Array.isArray(userContent) ? (userContent[0]?.text ?? "") : "");
      completion += 1;
      return completionResponse(
        JSON.stringify(
          completion === 1
            ? { insights: [], unresolvedQuestions: [], globalMemoryOperations: [] }
            : {
                insights: [],
                unresolvedQuestions: [],
                globalMemoryOperations: [
                  {
                    type: "create",
                    content: "Prefer concise follow-ups.",
                    evidenceRefs: [USER_NOTE_EVIDENCE_ID],
                    confidence: 1,
                  },
                ],
              },
        ),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await new OpenAICompatibleVisionProvider(config).generateInsights({
      ...insightInput(),
      note: "请把我喜欢简短跟进添加到 Global Memory。",
      screenshotDataUrl: undefined,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(prompts[0]).toContain('"explicitGlobalMemoryInstruction":true');
    expect(prompts[1]).toContain("no operation was returned");
    expect(result.globalMemoryOperations).toEqual([
      expect.objectContaining({ evidenceRefs: [USER_NOTE_EVIDENCE_ID] }),
    ]);
  });

  it("reports output truncated at the model token limit without a repair request", async () => {
    const fetchMock = vi.fn(async () => completionResponse('{"thread":', "length"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(new OpenAICompatibleVisionProvider(config).analyze(input)).rejects.toBeInstanceOf(
      ModelOutputTruncatedError,
    );
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("converts SDK timeouts into a stable provider error", async () => {
    const fetchMock = vi.fn(
      async (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => reject(new DOMException("The operation was aborted", "AbortError")),
            { once: true },
          );
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new OpenAICompatibleVisionProvider(config, {
      analysisTimeoutMs: 100,
      completionTimeoutMs: 10,
    });

    await expect(provider.analyze(input)).rejects.toBeInstanceOf(ModelProviderTimeoutError);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
