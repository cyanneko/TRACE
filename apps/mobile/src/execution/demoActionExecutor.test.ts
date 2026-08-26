import type { CreateMeetingCard, UpdateMeetingCard } from "@trace/contracts";
import { describe, expect, it } from "vitest";

import type { KeyValueStore } from "../storage/keyValueStore";
import { DemoActionExecutor } from "./demoActionExecutor";

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
    notes: "Send the deck.",
  },
};

function memoryStore(): KeyValueStore {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

describe("DemoActionExecutor", () => {
  it("returns the original result when the same run and action are confirmed twice", async () => {
    let idCalls = 0;
    const executor = new DemoActionExecutor({
      createId: () => {
        idCalls += 1;
        return "f06c058d-91f2-4545-aa0e-c0391a00ca11";
      },
      now: () => "2026-08-26T03:30:00.000Z",
      store: memoryStore(),
    });

    const first = await executor.execute("2f887426-3d1f-4b68-a6bc-58e975ac35fb", meeting);
    const second = await executor.execute("2f887426-3d1f-4b68-a6bc-58e975ac35fb", meeting);

    expect(second).toEqual(first);
    expect(executor.listRecords()).toHaveLength(1);
    expect(idCalls).toBe(1);
  });

  it("updates the resolved external calendar event instead of creating another id", async () => {
    const executor = new DemoActionExecutor({ store: memoryStore() });
    const update: UpdateMeetingCard = {
      id: "action-update-meeting",
      type: "update_meeting",
      title: "Move review",
      confidence: 0.9,
      evidenceRefs: ["evidence-2"],
      editableFields: ["changes"],
      riskFlags: [],
      memoryProposals: [],
      payload: {
        meetingId: "local-meeting-id",
        displayTitle: "Review",
        changes: [
          {
            field: "startAt",
            previousValue: "2026-08-27T07:00:00.000Z",
            nextValue: "2026-08-28T07:00:00.000Z",
          },
        ],
      },
    };

    const result = await executor.execute("2f887426-3d1f-4b68-a6bc-58e975ac35fb", update, {
      targetExternalId: "native-event-id",
    });

    expect(result).toMatchObject({ success: true, externalId: "native-event-id" });
  });
});
