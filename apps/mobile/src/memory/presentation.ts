import type { MemoryEntry } from "@trace/contracts";

function memoryValue(memory: MemoryEntry): Record<string, unknown> {
  return typeof memory.value === "object" && memory.value !== null
    ? (memory.value as Record<string, unknown>)
    : { value: memory.value };
}

export function memoryTitle(memory: MemoryEntry): string {
  const value = memoryValue(memory);
  if (memory.type === "open_loop") {
    return String(value.title ?? "Open loop");
  }
  if (memory.type === "relationship_fact") {
    return String(value.displayName ?? "Relationship fact");
  }
  return `${String(value.field ?? memory.key).replaceAll("contact:", "")} · ${String(value.value ?? "updated")}`;
}

export function memoryDetail(memory: MemoryEntry): string {
  const value = memoryValue(memory);
  if (memory.type === "open_loop") {
    return value.startAt ? `Starts ${String(value.startAt)}` : "Time unresolved";
  }
  if (memory.type === "relationship_fact") {
    return [value.company, value.jobTitle].filter(Boolean).map(String).join(" · ") || "Contact created";
  }
  return value.previousValue ? `Previously ${String(value.previousValue)}` : "Confirmed from this thread";
}

export function memoryTypeLabel(memory: MemoryEntry): string {
  const labels: Record<MemoryEntry["type"], string> = {
    contact_fact: "Contact fact",
    open_loop: "Open loop",
    preference: "Preference",
    relationship_fact: "Relationship",
  };
  return labels[memory.type];
}

export function memorySourceLabel(memory: MemoryEntry): string {
  const source = memory.sourceActionId ? "Confirmed action" : "Saved context";
  const evidenceCount = memory.sourceEvidenceRefs.length;
  const evidence = `${evidenceCount} evidence ${evidenceCount === 1 ? "reference" : "references"}`;
  return `${source} · ${evidence} · ${Math.round(memory.confidence * 100)}% confidence`;
}
