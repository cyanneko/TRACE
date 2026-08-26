import { describe, expect, it, vi } from "vitest";

import { getAnalyzeFixture } from "../fixtures/analyzeFixtures.js";
import {
  ModelOutputError,
  parseAnalyzeOutputWithRepair,
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
      notes: "",
      participantContactIds: [],
      participantNames: [],
      startAt: "2026-08-27T07:00:00.000Z",
    });
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
      notes: "",
      phones: [],
    });
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
