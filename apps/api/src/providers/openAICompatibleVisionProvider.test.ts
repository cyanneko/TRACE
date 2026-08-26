import type { AnalyzeRequest } from "@trace/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { VisionProviderConfig } from "../config.js";
import { getAnalyzeFixture } from "../fixtures/analyzeFixtures.js";
import { ModelOutputTruncatedError, ModelProviderTimeoutError } from "./modelProviderErrors.js";
import { OpenAICompatibleVisionProvider } from "./openAICompatibleVisionProvider.js";

const input: AnalyzeRequest = {
  contacts: [],
  currentTime: "2026-08-26T03:30:00.000Z",
  entityMemories: [],
  memories: [],
  meetings: [],
  note: "",
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
