import { describe, expect, it } from "vitest";

import { ActionCardSchema, InsightBundleSchema, InsightRequestSchema, UserVisionProviderSchema } from "./schemas";

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

  it("defaults memory references for evidence-only insights", () => {
    const result = InsightBundleSchema.parse({
      insights: [
        {
          title: "Prepare the deck",
          body: "The revised deck is due before the meeting.",
          importance: "high",
          evidenceRefs: ["evidence-1"],
        },
      ],
      unresolvedQuestions: [],
    });

    expect(result.insights[0]?.memoryRefs).toEqual([]);
  });
});

describe("InsightRequestSchema", () => {
  it("rejects tool results that were not confirmed in the same run", () => {
    const result = InsightRequestSchema.safeParse({
      sourceRunId: "2f887426-3d1f-4b68-a6bc-58e975ac35fb",
      thread: {
        summary: "A meeting was confirmed.",
        participants: [],
        evidence: [{ id: "evidence-1", quote: "Tomorrow at three." }],
        uncertainties: [],
      },
      confirmedActions: [],
      toolResults: [{ actionId: "not-confirmed", success: true, provider: "demo" }],
      memories: [],
      contacts: [],
      timezone: "Asia/Shanghai",
      currentTime: "2026-08-26T03:30:00.000Z",
    });

    expect(result.success).toBe(false);
  });
});

describe("UserVisionProviderSchema", () => {
  it("accepts a preset provider without endpoint duplication", () => {
    const result = UserVisionProviderSchema.safeParse({
      provider: "glm",
      apiKey: "test-key",
    });

    expect(result.success).toBe(true);
  });

  it("requires endpoint and model details for a custom provider", () => {
    const result = UserVisionProviderSchema.safeParse({
      provider: "custom",
      apiKey: "test-key",
    });

    expect(result.success).toBe(false);
  });

  it("allows fixture mode without a key", () => {
    const result = UserVisionProviderSchema.safeParse({ provider: "fixture" });

    expect(result.success).toBe(true);
  });
});
