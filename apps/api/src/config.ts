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

const EnvironmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(8787),
  VISION_API_KEY: OptionalNonEmptyStringSchema,
  VISION_BASE_URL: OptionalNonEmptyStringSchema.pipe(z.url().optional()),
  VISION_CUSTOM_ID: OptionalNonEmptyStringSchema,
  VISION_IMAGE_DETAIL: z.enum(["auto", "high", "low", "none"]).optional(),
  VISION_IMAGE_FORMAT: z.enum(["base64", "data-url"]).optional(),
  VISION_JSON_MODE: OptionalBooleanSchema,
  VISION_MODEL: OptionalNonEmptyStringSchema,
  VISION_PROVIDER: z.enum(["custom", "deepseek", "doubao", "fixture", "glm"]).default("fixture"),
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
};

type VisionPreset = {
  baseURL: string;
  imageDetail?: "auto" | "high" | "low";
  imageFormat: "base64" | "data-url";
  jsonMode: boolean;
  model: string;
};

const presets: Record<"deepseek" | "doubao" | "glm", VisionPreset> = {
  deepseek: {
    baseURL: "https://api.deepseek.com",
    imageDetail: "high" as const,
    imageFormat: "data-url" as const,
    jsonMode: true,
    model: "deepseek-v4-flash-vision-exp",
  },
  doubao: {
    baseURL: "https://ark.cn-beijing.volces.com/api/v3",
    imageFormat: "data-url" as const,
    jsonMode: false,
    model: "doubao-seed-2-0-lite-260215",
  },
  glm: {
    baseURL: "https://open.bigmodel.cn/api/paas/v4",
    imageFormat: "base64" as const,
    jsonMode: false,
    model: "glm-4.6v-flash",
  },
};

export function resolveVisionProviderConfig(environment: Environment): VisionProviderConfig {
  if (environment.VISION_PROVIDER === "fixture") {
    throw new Error("Fixture mode does not have a remote vision provider configuration");
  }

  const preset = environment.VISION_PROVIDER === "custom" ? undefined : presets[environment.VISION_PROVIDER];
  const apiKey = environment.VISION_API_KEY;
  const baseURL = environment.VISION_BASE_URL ?? preset?.baseURL;
  const model = environment.VISION_MODEL ?? preset?.model;

  if (!apiKey || !baseURL || !model) {
    throw new Error("VISION_API_KEY, VISION_BASE_URL, and VISION_MODEL are required for a remote provider");
  }

  const configuredDetail = environment.VISION_IMAGE_DETAIL;
  return {
    apiKey,
    baseURL,
    id: environment.VISION_PROVIDER === "custom" ? (environment.VISION_CUSTOM_ID ?? "custom") : environment.VISION_PROVIDER,
    imageDetail: configuredDetail === "none" ? undefined : (configuredDetail ?? preset?.imageDetail),
    imageFormat: environment.VISION_IMAGE_FORMAT ?? preset?.imageFormat ?? "data-url",
    jsonMode: environment.VISION_JSON_MODE ?? preset?.jsonMode ?? false,
    model,
  };
}
