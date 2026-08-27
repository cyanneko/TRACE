import type { CreateMeetingCard, MemoryEntry, ToolResult, UpdateContactCard } from "@trace/contracts";
import { describe, expect, it } from "vitest";

import { deleteMemoryEntry, deriveMemoryCandidates, mergeMemoryEntries } from "./policy";

const runId = "2f887426-3d1f-4b68-a6bc-58e975ac35fb";
const now = "2026-08-26T03:30:00.000Z";

const meeting: CreateMeetingCard = {
  id: "action-meeting",
  type: "create_meeting",
  title: "Create meeting",
  confidence: 0.9,
  evidenceRefs: ["evidence-1"],
  editableFields: [],
  riskFlags: [],
  memoryProposals: [],
  payload: {
    title: "Review",
    startAt: "2026-08-27T07:00:00.000Z",
    endAt: "2026-08-27T07:30:00.000Z",
    timezone: "Asia/Shanghai",
    participantContactIds: ["contact-maya"],
    participantNames: ["Maya"],
  },
};

const success: ToolResult = {
  actionId: meeting.id,
  success: true,
  provider: "demo",
  externalId: "demo-event-1",
};

describe("deriveMemoryCandidates", () => {
  it("writes memory only for successful confirmed actions", () => {
    const failed = { ...success, success: false };

    expect(
      deriveMemoryCandidates({
        sourceRunId: runId,
        actions: [meeting],
        results: [failed],
        now,
        createId: () => "8b9b25de-8616-45f5-b9fd-baa09ae8f6dc",
      }),
    ).toEqual([]);
  });

  it("creates a traceable open loop for a successful meeting", () => {
    const memories = deriveMemoryCandidates({
      sourceRunId: runId,
      actions: [meeting],
      results: [success],
      now,
      createId: () => "8b9b25de-8616-45f5-b9fd-baa09ae8f6dc",
    });

    expect(memories[0]).toMatchObject({
      contactId: "contact-maya",
      type: "open_loop",
      status: "active",
      sourceRunId: runId,
      sourceActionId: meeting.id,
      sourceEvidenceRefs: ["evidence-1"],
    });
  });
});

describe("mergeMemoryEntries", () => {
  it("supersedes an older contact fact with the same identity", () => {
    const update: UpdateContactCard = {
      id: "action-update",
      type: "update_contact",
      title: "Update Maya",
      confidence: 0.95,
      evidenceRefs: ["evidence-2"],
      editableFields: [],
      riskFlags: [],
      memoryProposals: [],
      payload: {
        contactId: "contact-maya",
        displayName: "Maya",
        changes: [{ field: "company", previousValue: "Atelier", nextValue: "Northstar" }],
      },
    };
    const previous: MemoryEntry = {
      id: "a2880298-1057-4f52-a6c0-6bcd9e84e724",
      contactId: "contact-maya",
      type: "contact_fact",
      key: "contact:company",
      value: { value: "Atelier" },
      status: "active",
      sourceRunId: "67238414-75e6-41e7-afb7-70feeb44ec08",
      sourceEvidenceRefs: ["old-evidence"],
      confidence: 0.8,
      createdAt: "2026-08-20T03:30:00.000Z",
      updatedAt: "2026-08-20T03:30:00.000Z",
    };
    const [candidate] = deriveMemoryCandidates({
      sourceRunId: runId,
      actions: [update],
      results: [{ actionId: update.id, success: true, provider: "demo", externalId: "contact-maya" }],
      now,
      createId: () => "b4926602-b709-4216-ac97-685889ced95a",
    });

    const merged = mergeMemoryEntries([previous], [candidate!]);

    expect(merged.entries.find((memory) => memory.id === previous.id)?.status).toBe("superseded");
    expect(merged.entries.find((memory) => memory.id === candidate!.id)?.status).toBe("active");
    expect(merged.supersededMemoryIds).toEqual([previous.id]);
  });

  it("does not duplicate the same semantic memory on another run", () => {
    const [candidate] = deriveMemoryCandidates({
      sourceRunId: runId,
      actions: [meeting],
      results: [success],
      now,
      createId: () => "8b9b25de-8616-45f5-b9fd-baa09ae8f6dc",
    });
    const repeated = { ...candidate!, id: "b4926602-b709-4216-ac97-685889ced95a", sourceRunId: "67238414-75e6-41e7-afb7-70feeb44ec08" };

    const merged = mergeMemoryEntries([candidate!], [repeated]);

    expect(merged.entries).toHaveLength(1);
    expect(merged.writtenMemoryIds).toEqual([]);
  });

  it("marks a memory deleted without erasing its audit trail", () => {
    const [candidate] = deriveMemoryCandidates({
      sourceRunId: runId,
      actions: [meeting],
      results: [success],
      now,
      createId: () => "8b9b25de-8616-45f5-b9fd-baa09ae8f6dc",
    });

    const deleted = deleteMemoryEntry([candidate!], candidate!.id, "2026-08-26T04:00:00.000Z");

    expect(deleted[0]?.status).toBe("deleted");
    expect(deleted[0]?.updatedAt).toBe("2026-08-26T04:00:00.000Z");
  });
});
