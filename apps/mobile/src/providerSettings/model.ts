import {
  VISION_PROVIDER_PRESETS,
  type ProviderInfo,
  type UserVisionProvider,
} from "@trace/contracts";

export function describeUserVisionProvider(
  settings: UserVisionProvider | null,
  serverProvider: ProviderInfo | null,
): ProviderInfo | null {
  if (!settings) {
    return serverProvider;
  }

  if (settings.provider === "fixture") {
    return {
      fixture: true,
      id: "fixture",
      model: "trace-analyze-fixtures",
    };
  }

  const preset = settings.provider === "custom" ? undefined : VISION_PROVIDER_PRESETS[settings.provider];
  return {
    fixture: false,
    id: settings.provider === "custom" ? (settings.customId ?? "custom") : settings.provider,
    model: settings.model ?? preset?.model ?? "Not configured",
  };
}
