import { ExpoContactSource } from "../contacts/expoContactSource";
import { SqliteEntityRepository } from "../entities/sqliteEntityRepository";
import { ExpoActionExecutor } from "../execution/expoActionExecutor";
import { SqliteMemoryRepository } from "../memory/sqliteMemoryRepository";
import { ExpoMeetingSource } from "../meetings/expoMeetingSource";
import type { PlatformServices } from "./types";

export function createPlatformServices(): PlatformServices {
  return {
    contacts: new ExpoContactSource(),
    entities: new SqliteEntityRepository(),
    executor: new ExpoActionExecutor(),
    memories: new SqliteMemoryRepository(),
    meetings: new ExpoMeetingSource(),
    capabilities: {
      actions: "native",
      calendar: "read-write",
      contacts: "native",
      entities: "sqlite",
      memory: "sqlite",
    },
  };
}
