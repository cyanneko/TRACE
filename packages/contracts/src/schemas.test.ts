import { describe, expect, it } from "vitest";

import {
  ActionCardSchema,
  AnalyzeRequestSchema,
  AnalyzeModelOutputSchema,
  ContactRecordSchema,
  EntityMemorySchema,
  InsightBundleSchema,
  InsightRequestSchema,
  MeetingRecordSchema,
  UserVisionProviderSchema,
} from "./schemas";

const analyzeContext = {
  contacts: [],
  currentTime: "2026-08-26T03:30:00.000Z",
  entityMemories: [],
  meetings: [],
  memories: [],
  timezone: "Asia/Shanghai",
};

describe("AnalyzeRequestSchema", () => {
  it("accepts a description without a screenshot", () => {
    const result = AnalyzeRequestSchema.safeParse({
      ...analyzeContext,
      note: "Maya asked to meet tomorrow at 3 PM.",
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.actionScope).toBe("all");
  });

  it("accepts a prior thread for a meetings-only second pass", () => {
    const result = AnalyzeRequestSchema.safeParse({
      ...analyzeContext,
      actionScope: "meetings",
      note: "Continue planning from the first pass.",
      priorThread: {
        summary: "Kai and Lina agreed to an interview.",
        participants: [{ displayName: "Kai", confidence: 1, isSelf: true }],
        evidence: [{ id: "evidence-self", quote: "I am Kai.", speaker: "User" }],
        uncertainties: [],
      },
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.priorThread?.participants[0]?.isSelf).toBe(true);
  });

  it("requires at least a screenshot or a description", () => {
    expect(AnalyzeRequestSchema.safeParse(analyzeContext).success).toBe(false);
  });
});

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

  it("accepts a minimal contact created from a visible chat name", () => {
    const result = ActionCardSchema.safeParse({
      id: "action-contact-minimal",
      type: "create_contact",
      title: "Create contact River",
      confidence: 0.78,
      evidenceRefs: ["evidence-direct-reply"],
      editableFields: ["displayName"],
      riskFlags: [],
      memoryProposals: [
        {
          target: { type: "action_entity" },
          content: "River directly asked to continue the conversation next week.",
          evidenceRefs: ["evidence-direct-reply"],
        },
      ],
      payload: {
        displayName: "River",
        givenName: "",
        familyName: "",
        company: "",
        jobTitle: "",
        phones: [],
        emails: [],
        notes: "",
      },
    });

    expect(result.success).toBe(true);
    if (result.success && result.data.type === "create_contact") {
      expect(result.data.payload.isSelf).toBe(false);
      expect(result.data.payload.interactionSummary).toBe("");
    }
  });

  it("accepts a grounded meeting update", () => {
    const result = ActionCardSchema.safeParse({
      id: "action-update-meeting",
      type: "update_meeting",
      title: "Move the design review",
      confidence: 0.93,
      evidenceRefs: ["evidence-new-time"],
      editableFields: ["meetingId", "changes"],
      riskFlags: [],
      memoryProposals: [],
      payload: {
        meetingId: "meeting-design-review",
        displayTitle: "Design review",
        participantNames: [],
        changes: [
          {
            field: "startAt",
            previousValue: "2026-08-27T07:00:00.000Z",
            nextValue: "2026-08-28T08:00:00.000Z",
          },
          {
            field: "endAt",
            previousValue: "2026-08-27T07:30:00.000Z",
            nextValue: "2026-08-28T08:30:00.000Z",
          },
        ],
      },
    });

    expect(result.success).toBe(true);
  });
});

describe("AnalyzeModelOutputSchema", () => {
  it("does not truncate or reject more than three action cards", () => {
    const actionCards = Array.from({ length: 6 }, (_, index) => ({
      id: `action-${index}`,
      type: "create_contact" as const,
      title: `Create contact ${index}`,
      confidence: 0.8,
      evidenceRefs: ["evidence-1"],
      editableFields: ["displayName"],
      riskFlags: [],
      memoryProposals: [],
      payload: {
        displayName: `Person ${index}`,
        givenName: "",
        familyName: "",
        company: "",
        jobTitle: "",
        phones: [],
        emails: [],
        notes: "",
        isSelf: false,
        interactionSummary: "Direct conversation",
      },
    }));
    const result = AnalyzeModelOutputSchema.safeParse({
      thread: {
        summary: "Several people directly interacted with the user.",
        participants: [],
        evidence: [{ id: "evidence-1", quote: "Let's stay in touch." }],
        uncertainties: [],
      },
      actionCards,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.actionCards).toHaveLength(6);
    }
  });
});

describe("entity records", () => {
  const timestamps = {
    createdAt: "2026-08-26T03:30:00.000Z",
    updatedAt: "2026-08-26T03:30:00.000Z",
  };

  it("accepts empty contact and meeting drafts", () => {
    const contact = ContactRecordSchema.safeParse({
      id: "9c35d7d1-46af-4612-af3a-97c2bc793027",
      displayName: "",
      phones: [],
      emails: [],
      isSelf: false,
      status: "draft",
      source: "trace",
      ...timestamps,
    });
    const meeting = MeetingRecordSchema.safeParse({
      id: "05227a21-b75f-41c1-9f48-720875cacbcd",
      title: "",
      timezone: "",
      allDay: false,
      participantContactIds: [],
      status: "draft",
      source: "trace",
      ...timestamps,
    });

    expect(contact.success).toBe(true);
    expect(meeting.success).toBe(true);
  });

  it("rejects active entities without their identifying fields", () => {
    const contact = ContactRecordSchema.safeParse({
      id: "9c35d7d1-46af-4612-af3a-97c2bc793027",
      displayName: "",
      phones: [],
      emails: [],
      isSelf: false,
      status: "active",
      source: "trace",
      ...timestamps,
    });
    const meeting = MeetingRecordSchema.safeParse({
      id: "05227a21-b75f-41c1-9f48-720875cacbcd",
      title: "",
      timezone: "",
      allDay: false,
      participantContactIds: [],
      status: "active",
      source: "trace",
      ...timestamps,
    });

    expect(contact.success).toBe(false);
    expect(meeting.success).toBe(false);
  });

  it("accepts a locally owned global memory", () => {
    const memory = EntityMemorySchema.safeParse({
      id: "0a66c15b-e77a-4607-bfd5-96b3805e2f16",
      ownerType: "global",
      ownerId: "00000000-0000-4000-8000-000000000000",
      content: "Prefer concise meeting summaries.",
      status: "active",
      source: "manual",
      sourceEvidenceRefs: [],
      confidence: 1,
      ...timestamps,
    });

    expect(memory.success).toBe(true);
  });

  it("preserves old memory content while stripping its legacy category", () => {
    const memory = EntityMemorySchema.parse({
      id: "1a66c15b-e77a-4607-bfd5-96b3805e2f16",
      ownerType: "contact",
      ownerId: "2a66c15b-e77a-4607-bfd5-96b3805e2f16",
      kind: "preference",
      content: "Prefers a written summary before meetings.",
      status: "active",
      source: "manual",
      sourceEvidenceRefs: [],
      confidence: 1,
      ...timestamps,
    });

    expect(memory.content).toBe("Prefers a written summary before meetings.");
    expect("kind" in memory).toBe(false);
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
    expect(result.globalMemoryOperations).toEqual([]);
  });

  it("accepts a grounded category-free global memory operation", () => {
    const result = InsightBundleSchema.safeParse({
      insights: [],
      unresolvedQuestions: [],
      globalMemoryOperations: [
        {
          type: "create",
          content: "Prefer concise summaries across threads.",
          evidenceRefs: ["evidence-1"],
          confidence: 0.92,
        },
      ],
    });

    expect(result.success).toBe(true);
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
      entityMemories: [],
      contacts: [],
      meetings: [],
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
