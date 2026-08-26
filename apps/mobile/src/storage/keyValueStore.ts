export type KeyValueStore = {
  getItem(key: string): string | null;
  removeItem(key: string): void;
  setItem(key: string, value: string): void;
};

const fallbackValues = new Map<string, string>();

const fallbackStore: KeyValueStore = {
  getItem: (key) => fallbackValues.get(key) ?? null,
  removeItem: (key) => {
    fallbackValues.delete(key);
  },
  setItem: (key, value) => {
    fallbackValues.set(key, value);
  },
};

export function getDeviceKeyValueStore(): KeyValueStore {
  const candidate = (globalThis as { localStorage?: KeyValueStore }).localStorage;
  return candidate ?? fallbackStore;
}
