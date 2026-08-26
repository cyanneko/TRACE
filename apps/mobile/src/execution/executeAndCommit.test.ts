import type { CreateContactCard, ToolResult } from "@trace/contracts";
import { describe, expect, it } from "vitest";

import { WebEntityRepository } from "../entities/webEntityRepository";
import type { KeyValueStore } from "../storage/keyValueStore";
import { executeAndCommit } from "./executeAndCommit";
import type { ActionExecutor } from "./types";

const action: CreateContactCard = {
  id: "create-river",
  type: "create_contact",
  title: "Create River",
  confidence: 0.9,
  evidenceRefs: ["evidence-river"],
  editableFields: ["displayName"],
  riskFlags: [],
  memoryProposals: [
    {
      target: { type: "action_entity" },
      kind: "context",
      content: "River asked to stay in touch.",
      evidenceRefs: ["evidence-river"],
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
    isSelf: false,
    interactionSummary: "River asked to stay in touch.",
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

function entities() {
  let next = 1;
  return new WebEntityRepository({
    createId: () => `00000000-0000-4000-8000-${String(next++).padStart(12, "0")}`,
    now: () => "2026-08-26T03:30:00.000Z",
    store: memoryStore(),
  });
}

describe("executeAndCommit", () => {
  it("does not touch entity memory when the external tool fails", async () => {
    const repository = entities();
    const executor: ActionExecutor = {
      execute: async (): Promise<ToolResult> => ({
        actionId: action.id,
        success: false,
        provider: "demo",
        error: "Permission denied.",
      }),
    };

    const result = await executeAndCommit(
      "20000000-0000-4000-8000-000000000010",
      action,
      executor,
      repository,
      "Asia/Shanghai",
    );

    expect(result.success).toBe(false);
    expect(await repository.listContacts()).toEqual([]);
  });

  it("returns the committed local entity reference after an external success", async () => {
    const repository = entities();
    const executor: ActionExecutor = {
      execute: async (): Promise<ToolResult> => ({
        actionId: action.id,
        success: true,
        provider: "demo",
        externalId: "demo-contact-river",
      }),
    };

    const result = await executeAndCommit(
      "20000000-0000-4000-8000-000000000011",
      action,
      executor,
      repository,
      "Asia/Shanghai",
    );

    expect(result).toMatchObject({
      success: true,
      entityRef: { type: "contact", externalId: "demo-contact-river" },
    });
    expect(await repository.listContacts()).toHaveLength(1);
  });

  it("reports a pending local failure without hiding the successful external id", async () => {
    const repository = entities();
    const executor: ActionExecutor = {
      execute: async (): Promise<ToolResult> => ({
        actionId: action.id,
        success: true,
        provider: "demo",
        externalId: "demo-contact-river",
      }),
    };

    const result = await executeAndCommit(
      "invalid-run-id",
      action,
      executor,
      repository,
      "Asia/Shanghai",
    );

    expect(result).toMatchObject({ success: false, externalId: "demo-contact-river" });
    expect(result.error).toContain("device write succeeded");
    expect(await repository.listContacts()).toEqual([]);
  });
});
