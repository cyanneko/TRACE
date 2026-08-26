import type { VisionImageDetail, VisionImageFormat } from "./schemas.js";

export type VisionProviderPresetId = "deepseek" | "doubao" | "glm";
export type VisionThinkingMode = "disabled" | "enabled";

export type VisionProviderPreset = {
  baseURL: string;
  imageDetail?: Exclude<VisionImageDetail, "none">;
  imageFormat: VisionImageFormat;
  jsonMode: boolean;
  label: string;
  model: string;
  thinking?: VisionThinkingMode;
};

export const VISION_PROVIDER_PRESETS: Record<VisionProviderPresetId, VisionProviderPreset> = {
  deepseek: {
    baseURL: "https://api.deepseek.com",
    imageDetail: "high",
    imageFormat: "data-url",
    jsonMode: true,
    label: "DeepSeek",
    model: "deepseek-v4-flash-vision-exp",
    thinking: "disabled",
  },
  doubao: {
    baseURL: "https://ark.cn-beijing.volces.com/api/v3",
    imageFormat: "data-url",
    jsonMode: false,
    label: "Doubao",
    model: "doubao-seed-2-0-lite-260215",
  },
  glm: {
    baseURL: "https://open.bigmodel.cn/api/paas/v4",
    imageFormat: "base64",
    jsonMode: false,
    label: "GLM",
    model: "glm-4.6v-flash",
  },
};
