import type { UserVisionProvider } from "@trace/contracts";

export type ProviderSettingsRepository = {
  clear(): Promise<void>;
  load(): Promise<UserVisionProvider | null>;
  save(settings: UserVisionProvider): Promise<void>;
};

export type ProviderSettingsStorage = "browser" | "keychain";
