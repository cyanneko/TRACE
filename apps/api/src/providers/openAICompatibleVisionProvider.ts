import type { AnalyzeRequest } from "@trace/contracts";
import OpenAI from "openai";

import type { VisionProviderConfig } from "../config.js";
import { buildAnalyzePrompt, buildRepairPrompt } from "../prompts/analyze.js";
import type { ModelProvider } from "./modelProvider.js";
import { parseAnalyzeOutputWithRepair } from "./parseModelOutput.js";

export class OpenAICompatibleVisionProvider implements ModelProvider {
  readonly info;

  private readonly client: OpenAI;
  private readonly config: VisionProviderConfig;

  constructor(config: VisionProviderConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });
    this.config = config;
    this.info = {
      fixture: false,
      id: config.id,
      model: config.model,
    };
  }

  async analyze(input: AnalyzeRequest) {
    return parseAnalyzeOutputWithRepair({
      initial: () => this.complete(input, buildAnalyzePrompt(input)),
      repair: (invalidOutput) => this.complete(input, buildRepairPrompt(input, invalidOutput)),
    });
  }

  private async complete(input: AnalyzeRequest, prompt: string): Promise<string> {
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

    const response = await this.client.chat.completions.create({
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
      max_tokens: 4_096,
      ...responseFormat,
    });

    return response.choices[0]?.message.content ?? "";
  }
}
