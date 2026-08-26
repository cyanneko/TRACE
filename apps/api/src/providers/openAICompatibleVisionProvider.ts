import type { AnalyzeRequest } from "@trace/contracts";
import OpenAI, { APIConnectionTimeoutError } from "openai";

import type { VisionProviderConfig } from "../config.js";
import { buildAnalyzePrompt, buildRepairPrompt } from "../prompts/analyze.js";
import type { ModelProvider } from "./modelProvider.js";
import { ModelOutputTruncatedError, ModelProviderTimeoutError } from "./modelProviderErrors.js";
import { parseAnalyzeOutputWithRepair } from "./parseModelOutput.js";

const defaultCompletionTimeoutMs = 55_000;
const defaultAnalysisTimeoutMs = 100_000;

type ProviderRuntimeOptions = {
  analysisTimeoutMs?: number;
  completionTimeoutMs?: number;
};

type CompletionRequest = OpenAI.ChatCompletionCreateParamsNonStreaming & {
  thinking?: {
    type: "disabled" | "enabled";
  };
};

export class OpenAICompatibleVisionProvider implements ModelProvider {
  readonly info;

  private readonly client: OpenAI;
  private readonly config: VisionProviderConfig;
  private readonly analysisTimeoutMs: number;
  private readonly completionTimeoutMs: number;

  constructor(config: VisionProviderConfig, runtime: ProviderRuntimeOptions = {}) {
    this.analysisTimeoutMs = runtime.analysisTimeoutMs ?? defaultAnalysisTimeoutMs;
    this.completionTimeoutMs = runtime.completionTimeoutMs ?? defaultCompletionTimeoutMs;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      maxRetries: 0,
      timeout: this.completionTimeoutMs,
    });
    this.config = config;
    this.info = {
      fixture: false,
      id: config.id,
      model: config.model,
    };
  }

  async analyze(input: AnalyzeRequest) {
    const deadline = Date.now() + this.analysisTimeoutMs;
    return parseAnalyzeOutputWithRepair({
      initial: () => this.complete(input, buildAnalyzePrompt(input), deadline),
      repair: (invalidOutput) => this.complete(input, buildRepairPrompt(input, invalidOutput), deadline),
    });
  }

  private async complete(input: AnalyzeRequest, prompt: string, deadline: number): Promise<string> {
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) {
      throw new ModelProviderTimeoutError();
    }

    const imageUrl =
      this.config.imageFormat === "base64"
        ? input.screenshotDataUrl.slice(input.screenshotDataUrl.indexOf(",") + 1)
        : input.screenshotDataUrl;
    const imageDetail = this.config.imageDetail ? { detail: this.config.imageDetail } : {};
    const responseFormat = this.config.jsonMode
      ? {
          response_format: {
            type: "json_object" as const,
          },
        }
      : {};

    const request: CompletionRequest = {
      model: this.config.model,
      messages: [
        {
          role: "system",
          content: "You are TRACE's perception and planning agent. Return valid JSON and never execute actions.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt,
            },
            {
              type: "image_url",
              image_url: {
                url: imageUrl,
                ...imageDetail,
              },
            },
          ],
        },
      ],
      max_tokens: 8_192,
      ...responseFormat,
      ...(this.config.thinking ? { thinking: { type: this.config.thinking } } : {}),
    };

    let response;
    try {
      response = await this.client.chat.completions.create(request, {
        timeout: Math.min(remainingMs, this.completionTimeoutMs),
      });
    } catch (error) {
      if (error instanceof APIConnectionTimeoutError) {
        throw new ModelProviderTimeoutError({ cause: error });
      }
      throw error;
    }

    const choice = response.choices[0];
    if (choice?.finish_reason === "length") {
      throw new ModelOutputTruncatedError(response.usage?.completion_tokens);
    }

    return choice?.message.content ?? "";
  }
}
