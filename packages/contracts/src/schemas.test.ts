import { describe, expect, it } from "vitest";

import { ActionCardSchema, InsightBundleSchema } from "./schemas";

describe("ActionCardSchema", () => {
  it("accepts a grounded meeting proposal", () => {
    const result = ActionCardSchema.safeParse({
      id: "action-meeting-1",
      type: "create_meeting",
      title: "Schedule design review",
      confidence: 0.95,
      evidenceRefs: ["evidence-1"],
      editableFields: ["startAt", "endAt"],
      riskFlags: [],
      payload: {
        title: "Design review with Maya",
        startAt: "2026-08-27T02:00:00.000Z",
        endAt: "2026-08-27T02:30:00.000Z",
        timezone: "Asia/Shanghai",
        participantContactIds: ["contact-maya"],
        participantNames: ["Maya"],
        notes: "Review the revised onboarding flow.",
      },
    });

    expect(result.success).toBe(true);
  });

  it("rejects an update without any changes", () => {
    const result = ActionCardSchema.safeParse({
      id: "action-update-1",
      type: "update_contact",
      title: "Update Maya",
      confidence: 0.8,
      evidenceRefs: ["evidence-1"],
      editableFields: ["changes"],
      riskFlags: [],
      payload: {
        contactId: "contact-maya",
        displayName: "Maya Chen",
        changes: [],
      },
    });

    expect(result.success).toBe(false);
  });
});

describe("InsightBundleSchema", () => {
  it("requires evidence for every insight", () => {
    const result = InsightBundleSchema.safeParse({
      insights: [
        {
          title: "Follow up",
          body: "Send the revised deck before the meeting.",
          importance: "high",
          evidenceRefs: [],
        },
      ],
      unresolvedQuestions: [],
    });

    expect(result.success).toBe(false);
  });
});
