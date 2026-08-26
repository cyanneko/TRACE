import { afterEach, describe, expect, it } from "vitest";

import { WebProviderSettingsRepository } from "./repository";

const values = new Map<string, string>();

afterEach(() => {
  values.clear();
  delete (globalThis as { localStorage?: unknown }).localStorage;
});

function installLocalStorage() {
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

describe("WebProviderSettingsRepository", () => {
  it("persists a validated local BYOK configuration", async () => {
    installLocalStorage();
    const repository = new WebProviderSettingsRepository();

    await repository.save({ provider: "glm", apiKey: "local-key" });

    await expect(repository.load()).resolves.toEqual({ provider: "glm", apiKey: "local-key" });
  });

  it("discards malformed browser state", async () => {
    installLocalStorage();
    values.set("trace.vision-provider.v1", JSON.stringify({ provider: "custom" }));
    const repository = new WebProviderSettingsRepository();

    await expect(repository.load()).resolves.toBeNull();
    expect(values.size).toBe(0);
  });
});
