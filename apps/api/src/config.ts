import {
  VISION_PROVIDER_PRESETS,
  type UserVisionProvider,
  type VisionThinkingMode,
} from "@trace/contracts";
import { z } from "zod";

const OptionalNonEmptyStringSchema = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().trim().min(1).optional(),
);

const OptionalBooleanSchema = z.preprocess((value) => {
  if (value === undefined || value === "") {
    return undefined;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return value;
}, z.boolean().optional());

const OptionalImageDetailSchema = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.enum(["auto", "high", "low", "none"]).optional(),
);

const OptionalImageFormatSchema = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.enum(["base64", "data-url"]).optional(),
);

const EnvironmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(8787),
  VISION_API_KEY: OptionalNonEmptyStringSchema,
  VISION_BASE_URL: OptionalNonEmptyStringSchema.pipe(z.url().optional()),
  VISION_CUSTOM_ID: OptionalNonEmptyStringSchema,
  VISION_IMAGE_DETAIL: OptionalImageDetailSchema,
  VISION_IMAGE_FORMAT: OptionalImageFormatSchema,
  VISION_JSON_MODE: OptionalBooleanSchema,
  VISION_MODEL: OptionalNonEmptyStringSchema,
  VISION_PROVIDER: z.enum(["custom", "deepseek", "doubao", "fixture", "glm"]).default("fixture"),
  VISION_USER_HOST_ALLOWLIST: OptionalNonEmptyStringSchema,
});

export type Environment = z.infer<typeof EnvironmentSchema>;

export function readEnvironment(source: NodeJS.ProcessEnv = process.env): Environment {
  return EnvironmentSchema.parse(source);
}

export type VisionProviderConfig = {
  apiKey: string;
  baseURL: string;
  id: string;
  imageDetail?: "auto" | "high" | "low";
  imageFormat: "base64" | "data-url";
  jsonMode: boolean;
  model: string;
  thinking?: VisionThinkingMode;
};

type VisionProviderSelection = {
  apiKey?: string;
  baseURL?: string;
  customId?: string;
  imageDetail?: "auto" | "high" | "low" | "none";
  imageFormat?: "base64" | "data-url";
  jsonMode?: boolean;
  model?: string;
  provider: "custom" | "deepseek" | "doubao" | "glm";
};

function resolveRemoteVisionProviderConfig(selection: VisionProviderSelection): VisionProviderConfig {
  const preset = selection.provider === "custom" ? undefined : VISION_PROVIDER_PRESETS[selection.provider];
  const baseURL = selection.baseURL ?? preset?.baseURL;
  const model = selection.model ?? preset?.model;

  if (!selection.apiKey || !baseURL || !model) {
    throw new Error("An API key, base URL, and model are required for a remote provider");
  }

  const configuredDetail = selection.imageDetail;
  return {
    apiKey: selection.apiKey,
    baseURL,
    id: selection.provider === "custom" ? (selection.customId ?? "custom") : selection.provider,
    imageDetail: configuredDetail === "none" ? undefined : (configuredDetail ?? preset?.imageDetail),
    imageFormat: selection.imageFormat ?? preset?.imageFormat ?? "data-url",
    jsonMode: selection.jsonMode ?? preset?.jsonMode ?? false,
    model,
    thinking: preset?.thinking,
  };
}

export function resolveVisionProviderConfig(environment: Environment): VisionProviderConfig {
  if (environment.VISION_PROVIDER === "fixture") {
    throw new Error("Fixture mode does not have a remote vision provider configuration");
  }

  return resolveRemoteVisionProviderConfig({
    apiKey: environment.VISION_API_KEY,
    baseURL: environment.VISION_BASE_URL,
    customId: environment.VISION_CUSTOM_ID,
    imageDetail: environment.VISION_IMAGE_DETAIL,
    imageFormat: environment.VISION_IMAGE_FORMAT,
    jsonMode: environment.VISION_JSON_MODE,
    model: environment.VISION_MODEL,
    provider: environment.VISION_PROVIDER,
  });
}

export function resolveUserVisionProviderConfig(settings: UserVisionProvider): VisionProviderConfig {
  const provider = settings.provider;
  if (provider === "fixture") {
    throw new Error("Fixture mode does not have a remote vision provider configuration");
  }

  return resolveRemoteVisionProviderConfig({
    apiKey: settings.apiKey,
    baseURL: settings.baseURL,
    customId: settings.customId,
    imageDetail: settings.imageDetail,
    imageFormat: settings.imageFormat,
    jsonMode: settings.jsonMode,
    model: settings.model,
    provider,
  });
}

export function assertUserVisionProviderAllowed(config: VisionProviderConfig, environment: Environment): void {
  if (environment.NODE_ENV !== "production") {
    return;
  }

  const url = new URL(config.baseURL);
  const configuredHosts = environment.VISION_USER_HOST_ALLOWLIST?.split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean) ?? [];
  const allowedHosts = new Set([
    "api.deepseek.com",
    "ark.cn-beijing.volces.com",
    "open.bigmodel.cn",
    ...configuredHosts,
  ]);

  if (url.protocol !== "https:" || !allowedHosts.has(url.hostname.toLowerCase())) {
    throw new Error("This provider endpoint is not allowed by the TRACE deployment");
  }
}
