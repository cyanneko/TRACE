import type { ContactSource } from "../contacts/types";
import type { EntityRepository } from "../entities/types";
import type { ActionExecutor } from "../execution/types";
import type { MemoryRepository } from "../memory/types";

export type PlatformCapabilities = {
  actions: "demo" | "native";
  calendar: "demo" | "read-write";
  contacts: "demo" | "native";
  entities: "local-storage" | "sqlite";
  memory: "local-storage" | "sqlite";
};

export type PlatformServices = {
  contacts: ContactSource;
  entities: EntityRepository;
  executor: ActionExecutor;
  memories: MemoryRepository;
  capabilities: PlatformCapabilities;
};
