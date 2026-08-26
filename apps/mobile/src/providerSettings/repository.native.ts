import { UserVisionProviderSchema, type UserVisionProvider } from "@trace/contracts";
import * as SecureStore from "expo-secure-store";

import type { ProviderSettingsRepository, ProviderSettingsStorage } from "./types";

const storageKey = "trace.vision-provider.v1";

export class NativeProviderSettingsRepository implements ProviderSettingsRepository {
  async clear() {
    await SecureStore.deleteItemAsync(storageKey);
  }

  async load(): Promise<UserVisionProvider | null> {
    const stored = await SecureStore.getItemAsync(storageKey);
    if (!stored) {
      return null;
    }

    try {
      const parsed = UserVisionProviderSchema.safeParse(JSON.parse(stored));
      if (parsed.success) {
        return parsed.data;
      }
    } catch {
      // Invalid Keychain state is discarded below.
    }

    await this.clear();
    return null;
  }

  async save(settings: UserVisionProvider) {
    await SecureStore.setItemAsync(storageKey, JSON.stringify(UserVisionProviderSchema.parse(settings)), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  }
}

export function createProviderSettingsRepository(): ProviderSettingsRepository {
  return new NativeProviderSettingsRepository();
}

export const providerSettingsStorage: ProviderSettingsStorage = "keychain";
