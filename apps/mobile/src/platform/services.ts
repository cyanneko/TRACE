import { DemoContactSource } from "../contacts/demoContactSource";
import { WebEntityRepository } from "../entities/webEntityRepository";
import { DemoActionExecutor } from "../execution/demoActionExecutor";
import { WebMemoryRepository } from "../memory/webMemoryRepository";
import { DemoMeetingSource } from "../meetings/demoMeetingSource";
import type { PlatformServices } from "./types";

export function createPlatformServices(): PlatformServices {
  return {
    contacts: new DemoContactSource(),
    entities: new WebEntityRepository(),
    executor: new DemoActionExecutor(),
    memories: new WebMemoryRepository(),
    meetings: new DemoMeetingSource(),
    capabilities: {
      actions: "demo",
      calendar: "demo",
      contacts: "demo",
      entities: "local-storage",
      memory: "local-storage",
    },
  };
}
