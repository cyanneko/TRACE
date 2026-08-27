import { EntityMemorySchema, type EntityMemory } from "@trace/contracts";

import type { EntityFactoryOptions } from "./model";
import type { EntityStore } from "./storageModel";

type RawEntity = Record<string, unknown>;

function records(value: unknown): RawEntity[] {
  return Array.isArray(value)
    ? value.filter((item): item is RawEntity => typeof item === "object" && item !== null)
    : [];
}

function normalized(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export function migrateEntityNotes(
  rawStore: unknown,
  store: EntityStore,
  factory: EntityFactoryOptions,
): { changed: boolean; store: EntityStore } {
  if (typeof rawStore !== "object" || rawStore === null) {
    return { changed: false, store };
  }

  const raw = rawStore as Record<string, unknown>;
  const memories = [...store.memories];
  let changed = false;

  const migrate = (ownerType: "contact" | "meeting", entities: RawEntity[]) => {
    for (const entity of entities) {
      if (!Object.prototype.hasOwnProperty.call(entity, "notes")) continue;
      changed = true;

      const ownerId = typeof entity.id === "string" ? entity.id : "";
      const content = typeof entity.notes === "string" ? entity.notes.trim() : "";
      if (!ownerId || !content) continue;

      const duplicate = memories.some(
        (memory) =>
          memory.status === "active" &&
          memory.ownerType === ownerType &&
          memory.ownerId === ownerId &&
          normalized(memory.content) === normalized(content),
      );
      if (duplicate) continue;

      const owner = ownerType === "contact"
        ? store.contacts.find((contact) => contact.id === ownerId)
        : store.meetings.find((meeting) => meeting.id === ownerId);
      if (!owner) continue;

      const memory: EntityMemory = EntityMemorySchema.parse({
        id: factory.createId(),
        ownerType,
        ownerId,
        content,
        status: "active",
        source: "migration",
        sourceEvidenceRefs: [],
        confidence: 1,
        createdAt: owner.createdAt,
        updatedAt: factory.now(),
      });
      memories.push(memory);
    }
  };

  migrate("contact", records(raw.contacts));
  migrate("meeting", records(raw.meetings));
  return { changed, store: changed ? { ...store, memories } : store };
}
