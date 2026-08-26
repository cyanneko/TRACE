import { DemoContactSource } from "../contacts/demoContactSource";
import { DemoActionExecutor } from "../execution/demoActionExecutor";
import { WebMemoryRepository } from "../memory/webMemoryRepository";
import type { PlatformServices } from "./types";

export function createPlatformServices(): PlatformServices {
  return {
    contacts: new DemoContactSource(),
    executor: new DemoActionExecutor(),
    memories: new WebMemoryRepository(),
    capabilities: {
      actions: "demo",
      calendar: "demo",
      contacts: "demo",
      memory: "local-storage",
    },
  };
}
