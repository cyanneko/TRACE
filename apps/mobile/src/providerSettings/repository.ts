import { UserVisionProviderSchema, type UserVisionProvider } from "@trace/contracts";

import type { ProviderSettingsRepository, ProviderSettingsStorage } from "./types";

const storageKey = "trace.vision-provider.v1";
const fallbackValues = new Map<string, string>();

type LocalStorage = {
  getItem(key: string): string | null;
  removeItem(key: string): void;
  setItem(key: string, value: string): void;
};

function getLocalStorage(): LocalStorage {
  return (globalThis as { localStorage?: LocalStorage }).localStorage ?? {
    getItem: (key) => fallbackValues.get(key) ?? null,
    removeItem: (key) => {
      fallbackValues.delete(key);
    },
    setItem: (key, value) => {
      fallbackValues.set(key, value);
    },
  };
}

export class WebProviderSettingsRepository implements ProviderSettingsRepository {
  async clear() {
    getLocalStorage().removeItem(storageKey);
  }

  async load(): Promise<UserVisionProvider | null> {
    const stored = getLocalStorage().getItem(storageKey);
    if (!stored) {
      return null;
    }

    try {
      const parsed = UserVisionProviderSchema.safeParse(JSON.parse(stored));
      if (parsed.success && parsed.data.provider !== "fixture") {
        return parsed.data;
      }
    } catch {
      // Invalid local state is discarded below.
    }

    await this.clear();
    return null;
  }

  async save(settings: UserVisionProvider) {
    getLocalStorage().setItem(storageKey, JSON.stringify(UserVisionProviderSchema.parse(settings)));
  }
}

export function createProviderSettingsRepository(): ProviderSettingsRepository {
  return new WebProviderSettingsRepository();
}

export const providerSettingsStorage: ProviderSettingsStorage = "browser";
