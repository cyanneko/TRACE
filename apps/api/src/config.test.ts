import { describe, expect, it } from "vitest";

import { readEnvironment, resolveVisionProviderConfig } from "./config.js";

describe("vision provider configuration", () => {
  it("uses the DeepSeek vision experiment preset", () => {
    const environment = readEnvironment({
      NODE_ENV: "test",
      VISION_API_KEY: "test-key",
      VISION_PROVIDER: "deepseek",
    });

    expect(resolveVisionProviderConfig(environment)).toMatchObject({
      baseURL: "https://api.deepseek.com",
      id: "deepseek",
      imageFormat: "data-url",
      jsonMode: true,
      model: "deepseek-v4-flash-vision-exp",
    });
  });

  it("supports a GLM preset without application changes", () => {
    const environment = readEnvironment({
      NODE_ENV: "test",
      VISION_API_KEY: "test-key",
      VISION_PROVIDER: "glm",
    });

    expect(resolveVisionProviderConfig(environment)).toMatchObject({
      baseURL: "https://open.bigmodel.cn/api/paas/v4",
      id: "glm",
      imageFormat: "base64",
      model: "glm-4.6v-flash",
    });
  });

  it("allows a fully custom OpenAI-compatible provider", () => {
    const environment = readEnvironment({
      NODE_ENV: "test",
      VISION_API_KEY: "test-key",
      VISION_BASE_URL: "https://vision.example.com/v1",
      VISION_CUSTOM_ID: "lab-model",
      VISION_JSON_MODE: "true",
      VISION_MODEL: "vision-1",
      VISION_PROVIDER: "custom",
    });

    expect(resolveVisionProviderConfig(environment)).toMatchObject({
      baseURL: "https://vision.example.com/v1",
      id: "lab-model",
      jsonMode: true,
      model: "vision-1",
    });
  });
});
