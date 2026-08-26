import { describe, expect, it } from "vitest";

import {
  assertUserVisionProviderAllowed,
  readEnvironment,
  resolveUserVisionProviderConfig,
  resolveVisionProviderConfig,
} from "./config.js";

describe("vision provider configuration", () => {
  it("treats blank optional .env values as unset", () => {
    const environment = readEnvironment({
      NODE_ENV: "test",
      VISION_IMAGE_DETAIL: "",
      VISION_IMAGE_FORMAT: "",
      VISION_JSON_MODE: "",
    });

    expect(environment.VISION_IMAGE_DETAIL).toBeUndefined();
    expect(environment.VISION_IMAGE_FORMAT).toBeUndefined();
    expect(environment.VISION_JSON_MODE).toBeUndefined();
  });

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

  it("resolves a per-user Doubao override without mutating the environment", () => {
    const config = resolveUserVisionProviderConfig({
      provider: "doubao",
      apiKey: "user-key",
      model: "doubao-vision-test",
    });

    expect(config).toMatchObject({
      apiKey: "user-key",
      baseURL: "https://ark.cn-beijing.volces.com/api/v3",
      id: "doubao",
      model: "doubao-vision-test",
    });
  });

  it("blocks unlisted custom hosts on a public production deployment", () => {
    const environment = readEnvironment({ NODE_ENV: "production" });
    const config = resolveUserVisionProviderConfig({
      provider: "custom",
      apiKey: "user-key",
      baseURL: "https://internal.example.com/v1",
      model: "vision-1",
    });

    expect(() => assertUserVisionProviderAllowed(config, environment)).toThrow(/not allowed/);
  });

  it("allows deployment owners to add a production provider host", () => {
    const environment = readEnvironment({
      NODE_ENV: "production",
      VISION_USER_HOST_ALLOWLIST: "vision.example.com",
    });
    const config = resolveUserVisionProviderConfig({
      provider: "custom",
      apiKey: "user-key",
      baseURL: "https://vision.example.com/v1",
      model: "vision-1",
    });

    expect(() => assertUserVisionProviderAllowed(config, environment)).not.toThrow();
  });
});
