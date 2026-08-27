import { ExpoContactSource } from "../contacts/expoContactSource";
import { SqliteEntityRepository } from "../entities/sqliteEntityRepository";
import { ExpoActionExecutor } from "../execution/expoActionExecutor";
import { ExpoMeetingSource } from "../meetings/expoMeetingSource";
import type { PlatformServices } from "./types";

export function createPlatformServices(): PlatformServices {
  return {
    contacts: new ExpoContactSource(),
    entities: new SqliteEntityRepository(),
    executor: new ExpoActionExecutor(),
    meetings: new ExpoMeetingSource(),
    capabilities: {
      actions: "native",
      calendar: "read-write",
      contacts: "native",
      entities: "sqlite",
    },
  };
}
