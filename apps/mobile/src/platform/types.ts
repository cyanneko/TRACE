import type { ContactSource } from "../contacts/types";
import type { ActionExecutor } from "../execution/types";
import type { MemoryRepository } from "../memory/types";

export type PlatformCapabilities = {
  actions: "demo" | "native";
  calendar: "demo" | "write-only";
  contacts: "demo" | "native";
  memory: "local-storage" | "sqlite";
};

export type PlatformServices = {
  contacts: ContactSource;
  executor: ActionExecutor;
  memories: MemoryRepository;
  capabilities: PlatformCapabilities;
};
