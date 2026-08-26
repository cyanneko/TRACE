import { ExpoContactSource } from "../contacts/expoContactSource";
import { ExpoActionExecutor } from "../execution/expoActionExecutor";
import { SqliteMemoryRepository } from "../memory/sqliteMemoryRepository";
import type { PlatformServices } from "./types";

export function createPlatformServices(): PlatformServices {
  return {
    contacts: new ExpoContactSource(),
    executor: new ExpoActionExecutor(),
    memories: new SqliteMemoryRepository(),
    capabilities: {
      actions: "native",
      calendar: "write-only",
      contacts: "native",
      memory: "sqlite",
    },
  };
}
