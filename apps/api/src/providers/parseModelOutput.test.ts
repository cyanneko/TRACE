import { USER_NOTE_EVIDENCE_ID, type InsightRequest } from "@trace/contracts";
import { describe, expect, it, vi } from "vitest";

import { getAnalyzeFixture } from "../fixtures/analyzeFixtures.js";
import {
  ModelOutputError,
  parseAnalyzeOutputWithRepair,
  parseInsightOutputWithRepair,
  type ModelValidationIssue,
} from "./parseModelOutput.js";

describe("parseAnalyzeOutputWithRepair", () => {
  it("returns a valid first response without a repair call", async () => {
    const repair = vi.fn();

    const result = await parseAnalyzeOutputWithRepair({
      initial: async () => JSON.stringify(getAnalyzeFixture("meeting")),
      repair,
    });

    expect(result.actionCards[0]?.type).toBe("create_meeting");
    expect(repair).not.toHaveBeenCalled();
  });

  it("accepts fenced JSON, fills empty fields, and normalizes offset meeting timestamps", async () => {
    const repair = vi.fn();
    const output = {
      thread: {
        summary: "Maya confirmed a design review.",
        evidence: [{ id: "meeting-time", quote: "Tomorrow at 3 PM." }],
        participants: null,
        uncertainties: null,
      },
      actionCards: [
        {
          id: "create-review",
          type: "create_meeting",
          title: "Create design review",
          confidence: 0.92,
          editableFields: null,
          evidenceRefs: ["meeting-time"],
          memoryProposals: null,
          riskFlags: null,
          payload: {
            title: "Design review",
            startAt: "2026-08-27T15:00:00+08:00",
            endAt: "2026-08-27T15:30:00+08:00",
            timezone: "Asia/Shanghai",
            notes: null,
            participantContactIds: null,
            participantNames: null,
          },
        },
      ],
    };

    const result = await parseAnalyzeOutputWithRepair({
      initial: async () => `<think>structured response follows</think>\n\`\`\`json\n${JSON.stringify(output)}\n\`\`\``,
      repair,
    });

    const action = result.actionCards[0];
    expect(action?.type).toBe("create_meeting");
    if (action?.type !== "create_meeting") throw new Error("Expected a meeting action.");
    expect(action.payload).toMatchObject({
      endAt: "2026-08-27T07:30:00.000Z",
      participantContactIds: [],
      participantNames: [],
      startAt: "2026-08-27T07:00:00.000Z",
    });
    expect(action.payload).not.toHaveProperty("notes");
    expect(action.memoryProposals).toEqual([]);
    expect(result.thread.participants).toEqual([]);
    expect(repair).not.toHaveBeenCalled();
  });

  it("normalizes null optional contact fields without inventing identity data", async () => {
    const result = await parseAnalyzeOutputWithRepair({
      initial: async () =>
        JSON.stringify({
          thread: {
            summary: "A new person introduced themself.",
            evidence: [{ id: "intro", quote: "I am Lin." }],
          },
          actionCards: [
            {
              id: "create-lin",
              type: "create_contact",
              title: "Create Lin",
              confidence: 0.9,
              evidenceRefs: ["intro"],
              payload: {
                displayName: "Lin",
                givenName: null,
                familyName: null,
                company: null,
                jobTitle: null,
                phones: [""],
                emails: [""],
                notes: null,
                interactionSummary: null,
                isSelf: null,
              },
            },
          ],
        }),
      repair: vi.fn(),
    });

    const action = result.actionCards[0];
    expect(action?.type).toBe("create_contact");
    if (action?.type !== "create_contact") throw new Error("Expected a contact action.");
    expect(action.payload).toMatchObject({
      company: "",
      emails: [],
      familyName: "",
      givenName: "",
      interactionSummary: "",
      isSelf: false,
      jobTitle: "",
      phones: [],
    });
    expect(action.payload).not.toHaveProperty("notes");
  });

  it("normalizes legacy scalar phone and email contact changes into complete lists", async () => {
    const repair = vi.fn();
    const result = await parseAnalyzeOutputWithRepair({
      initial: async () =>
        JSON.stringify({
          thread: {
            summary: "Maya shared updated contact details.",
            participants: [{ displayName: "Maya", contactId: "contact-maya", confidence: 1 }],
            evidence: [{ id: "details", quote: "Use this number and email." }],
            uncertainties: [],
          },
          actionCards: [
            {
              id: "update-maya",
              type: "update_contact",
              title: "Update Maya",
              confidence: 0.95,
              evidenceRefs: ["details"],
              editableFields: ["changes"],
              riskFlags: [],
              memoryProposals: [],
              payload: {
                contactId: "contact-maya",
                displayName: "Maya",
                changes: [
                  { field: "phone", previousValue: null, nextValue: "+86 138 0000 0000" },
                  { field: "email", previousValue: null, nextValue: "maya@example.com" },
                ],
              },
            },
          ],
        }),
      repair,
    });

    expect(result.actionCards[0]).toMatchObject({
      type: "update_contact",
      payload: {
        changes: [
          { field: "phones", previousValue: [], nextValue: ["+86 138 0000 0000"] },
          { field: "emails", previousValue: [], nextValue: ["maya@example.com"] },
        ],
      },
    });
    expect(repair).not.toHaveBeenCalled();
  });

  it("omits a null contact match from an unmatched thread participant", async () => {
    const repair = vi.fn();
    const result = await parseAnalyzeOutputWithRepair({
      initial: async () =>
        JSON.stringify({
          thread: {
            summary: "Maya and a new candidate discussed an interview.",
            participants: [
              { displayName: "Maya", contactId: "contact-maya", confidence: 0.96 },
              { displayName: "Candidate", contactId: null, confidence: 0.88 },
            ],
            evidence: [{ id: "interview", quote: "See you at the interview." }],
            uncertainties: [],
          },
          actionCards: [],
        }),
      repair,
    });

    expect(result.thread.participants).toEqual([
      { displayName: "Maya", contactId: "contact-maya", confidence: 0.96 },
      { displayName: "Candidate", confidence: 0.88 },
    ]);
    expect(repair).not.toHaveBeenCalled();
  });

  it("repairs invalid JSON once", async () => {
    const repair = vi.fn(async () => JSON.stringify(getAnalyzeFixture("new-contact")));

    const result = await parseAnalyzeOutputWithRepair({
      initial: async () => "not-json",
      repair,
    });

    expect(result.actionCards[0]?.type).toBe("create_contact");
    expect(repair).toHaveBeenCalledOnce();
    expect(repair).toHaveBeenCalledWith("not-json", [
      { message: "Response is not valid JSON.", path: "$" },
    ]);
  });

  it("fails after one unsuccessful repair", async () => {
    const repair = vi.fn(async () => "still-not-json");

    const error = await parseAnalyzeOutputWithRepair({
      initial: async () => "not-json",
      repair,
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ModelOutputError);
    expect((error as ModelOutputError).issues).toEqual([
      { message: "Response is not valid JSON.", path: "$" },
    ]);
    expect(repair).toHaveBeenCalledOnce();
  });

  it("passes schema paths into the repair request", async () => {
    const repair = vi.fn(async (_invalidOutput: string, _issues: ModelValidationIssue[]) =>
      JSON.stringify(getAnalyzeFixture("meeting")),
    );

    await expect(
      parseAnalyzeOutputWithRepair({
        initial: async () => JSON.stringify({ thread: { summary: "Missing actionCards" } }),
        repair,
      }),
    ).resolves.toMatchObject({ actionCards: expect.any(Array) });

    expect(repair.mock.calls[0]?.[1]).toContainEqual({
      message: expect.any(String),
      path: "actionCards",
    });
  });
});

const insightGlobalMemoryId = "30000000-0000-4000-8000-000000000001";
const insightContactMemoryId = "30000000-0000-4000-8000-000000000002";

function insightRequest(): InsightRequest {
  const fixture = getAnalyzeFixture("meeting");
  const action = fixture.actionCards[0]!;
  const timestamps = {
    createdAt: "2026-08-20T00:00:00.000Z",
    updatedAt: "2026-08-20T00:00:00.000Z",
  };
  return {
    sourceRunId: "10000000-0000-4000-8000-000000000001",
    note: "Keep the output concise.",
    thread: fixture.thread,
    confirmedActions: [action],
    toolResults: [{ actionId: action.id, success: true, provider: "demo" }],
    entityMemories: [
      {
        id: insightGlobalMemoryId,
        ownerType: "global",
        ownerId: "00000000-0000-4000-8000-000000000000",
        content: "Prefer concise summaries.",
        status: "active",
        source: "manual",
        sourceEvidenceRefs: [],
        confidence: 1,
        ...timestamps,
      },
      {
        id: insightContactMemoryId,
        ownerType: "contact",
        ownerId: "40000000-0000-4000-8000-000000000001",
        content: "Maya expects the deck before the review.",
        status: "active",
        source: "manual",
        sourceEvidenceRefs: [],
        confidence: 1,
        ...timestamps,
      },
    ],
    contacts: [],
    meetings: [],
    timezone: "Asia/Shanghai",
    currentTime: "2026-08-26T03:30:00.000Z",
  };
}

describe("parseInsightOutputWithRepair", () => {
  it("repairs insights that ignore an active response-style Global Memory", async () => {
    const input = {
      ...insightRequest(),
      entityMemories: insightRequest().entityMemories.map((memory) =>
        memory.id === insightGlobalMemoryId
          ? { ...memory, content: "Use a natural catgirl voice and end suitable suggestions with 喵." }
          : memory,
      ),
    };
    const evidenceId = input.thread.evidence[0]!.id;
    const repair = vi.fn(async (_invalidOutput: string, _issues: ModelValidationIssue[]) =>
      JSON.stringify({
        insights: [
          {
            title: "Prepare the deck 喵",
            body: "Send Maya the revised deck before the review 喵.",
            importance: "high",
            evidenceRefs: [evidenceId],
            memoryRefs: [insightGlobalMemoryId],
          },
        ],
        unresolvedQuestions: [],
        globalMemoryOperations: [],
      }),
    );

    const result = await parseInsightOutputWithRepair({
      input,
      initial: async () =>
        JSON.stringify({
          insights: [
            {
              title: "Prepare the deck",
              body: "Send Maya the revised deck before the review.",
              importance: "high",
              evidenceRefs: [evidenceId],
              memoryRefs: [],
            },
          ],
          unresolvedQuestions: [],
          globalMemoryOperations: [],
        }),
      repair,
    });

    expect(repair).toHaveBeenCalledOnce();
    expect(repair.mock.calls[0]?.[1]).toContainEqual(
      expect.objectContaining({ path: "insights", message: expect.stringContaining("was not applied") }),
    );
    expect(result.insights[0]).toMatchObject({
      title: "Prepare the deck 喵",
      memoryRefs: [insightGlobalMemoryId],
    });
  });

  it("repairs an empty operation list when the user directly commands a Global Memory change", async () => {
    const input = {
      ...insightRequest(),
      note: "请把我喜欢简短跟进添加到 Global Memory。",
    };
    const repair = vi.fn(async (_invalidOutput: string, _issues: ModelValidationIssue[]) =>
      JSON.stringify({
        insights: [],
        unresolvedQuestions: [],
        globalMemoryOperations: [
          {
            type: "create",
            content: "Prefer concise follow-ups.",
            evidenceRefs: [USER_NOTE_EVIDENCE_ID],
            confidence: 1,
          },
        ],
      }),
    );

    const result = await parseInsightOutputWithRepair({
      input,
      initial: async () =>
        JSON.stringify({ insights: [], unresolvedQuestions: [], globalMemoryOperations: [] }),
      repair,
    });

    expect(repair).toHaveBeenCalledOnce();
    expect(repair.mock.calls[0]?.[1]).toContainEqual(
      expect.objectContaining({ path: "globalMemoryOperations" }),
    );
    expect(result.globalMemoryOperations).toEqual([
      expect.objectContaining({
        type: "create",
        evidenceRefs: [USER_NOTE_EVIDENCE_ID],
      }),
    ]);
  });

  it("accepts grounded references and category-free global memory operations", async () => {
    const input = insightRequest();
    const evidenceId = input.thread.evidence[0]!.id;
    const repair = vi.fn();
    const result = await parseInsightOutputWithRepair({
      input,
      initial: async () =>
        JSON.stringify({
          insights: [
            {
              title: "Prepare the concise deck",
              body: "The meeting memory and current agreement both point to a short pre-read.",
              importance: "high",
              evidenceRefs: [evidenceId],
              memoryRefs: [insightGlobalMemoryId, insightContactMemoryId],
            },
          ],
          unresolvedQuestions: [],
          globalMemoryOperations: [
            {
              type: "update",
              memoryId: insightGlobalMemoryId,
              content: "Prefer concise written summaries.",
              evidenceRefs: [evidenceId],
              confidence: 0.93,
            },
          ],
        }),
      repair,
    });

    expect(result.insights[0]?.memoryRefs).toEqual([
      insightGlobalMemoryId,
      insightContactMemoryId,
    ]);
    expect(result.globalMemoryOperations[0]).toMatchObject({
      type: "update",
      memoryId: insightGlobalMemoryId,
    });
    expect(repair).not.toHaveBeenCalled();
  });

  it("repairs an attempt to modify contact memory as global memory", async () => {
    const input = insightRequest();
    const evidenceId = input.thread.evidence[0]!.id;
    const repaired = {
      insights: [],
      unresolvedQuestions: [],
      globalMemoryOperations: [
        {
          type: "create",
          content: "Prefer concise written summaries.",
          evidenceRefs: [evidenceId],
          confidence: 0.9,
        },
      ],
    };
    const repair = vi.fn(async (_invalidOutput: string, _issues: ModelValidationIssue[]) =>
      JSON.stringify(repaired),
    );

    const result = await parseInsightOutputWithRepair({
      input,
      initial: async () =>
        JSON.stringify({
          insights: [],
          unresolvedQuestions: [],
          globalMemoryOperations: [
            {
              type: "delete",
              memoryId: insightContactMemoryId,
              evidenceRefs: [evidenceId],
              confidence: 0.8,
            },
          ],
        }),
      repair,
    });

    expect(result.globalMemoryOperations[0]?.type).toBe("create");
    expect(repair.mock.calls[0]?.[1]).toContainEqual({
      message: `Memory ${insightContactMemoryId} is not an active global memory.`,
      path: "globalMemoryOperations.0.memoryId",
    });
  });
});
