import type { ContactSource } from "../contacts/types";
import type { EntityRepository } from "../entities/types";
import type { ActionExecutor } from "../execution/types";
import type { MeetingSource } from "../meetings/types";

export type PlatformCapabilities = {
  actions: "demo" | "native";
  calendar: "demo" | "read-write";
  contacts: "demo" | "native";
  entities: "local-storage" | "sqlite";
};

export type PlatformServices = {
  contacts: ContactSource;
  entities: EntityRepository;
  executor: ActionExecutor;
  meetings: MeetingSource;
  capabilities: PlatformCapabilities;
};
