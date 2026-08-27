import {
  InsightBundleSchema,
  USER_NOTE_EVIDENCE_ID,
  type InsightRequest,
} from "@trace/contracts";
import { z } from "zod";

import { hasExplicitGlobalMemoryInstruction } from "../insights/globalMemoryInstruction.js";
import { isResponseBehaviorMemory } from "../insights/responseBehaviorMemory.js";

const outputSchema = z.toJSONSchema(InsightBundleSchema);

export function buildInsightsPrompt(input: InsightRequest): string {
  const activeMemories = input.entityMemories.filter((memory) => memory.status === "active");
  const explicitGlobalMemoryInstruction = hasExplicitGlobalMemoryInstruction(input.note);
  const context = {
    sourceRunId: input.sourceRunId,
    currentTime: input.currentTime,
    timezone: input.timezone,
    inputMode: input.screenshotDataUrl ? "screenshot_with_optional_description" : "description_only",
    userNote: input.note,
    userNoteEvidence: input.note
      ? { id: USER_NOTE_EVIDENCE_ID, quote: input.note, speaker: "User" }
      : null,
    explicitGlobalMemoryInstruction,
    thread: input.thread,
    confirmedActions: input.confirmedActions,
    toolResults: input.toolResults,
    contacts: input.contacts,
    meetings: input.meetings,
    memories: {
      global: activeMemories.filter((memory) => memory.ownerType === "global"),
      responseBehavior: activeMemories.filter(
        (memory) => memory.ownerType === "global" && isResponseBehaviorMemory(memory.content),
      ),
      contacts: activeMemories.filter((memory) => memory.ownerType === "contact"),
      meetings: activeMemories.filter((memory) => memory.ownerType === "meeting"),
    },
  };

  return [
    "You are TRACE's grounded insight and memory consolidation agent. Return one JSON object only.",
    "Use the original screenshot or description, the extracted thread context, confirmed actions, actual tool results, current entity indexes, and all three active memory scopes together.",
    "Treat toolResults as the source of truth for what actually happened. Never describe a failed or unconfirmed write as completed.",
    "Generate at most three useful, specific insights. Prefer implications, preparation, relationship continuity, risks, and concrete next steps over repeating contact or meeting fields.",
    "Every insight must cite exact IDs from thread.evidence or userNoteEvidence. memoryRefs may cite exact active memory IDs from global, contact, or meeting memory only when that memory materially supports the insight.",
    `The supplied userNoteEvidence is a valid grounding source with exact evidence ID ${USER_NOTE_EVIDENCE_ID}. It may be cited by insights or Global Memory operations when the user's own description or instruction supports the claim.`,
    "Write insights and suggested messages in the language most useful for the user's current conversation.",
    "Active memories.global is persistent user-controlled operating context. memories.responseBehavior highlights the active Global Memory items that explicitly control TRACE's replies. Apply every item in memories.responseBehavior, plus every other relevant Global Memory preference, to the current user-facing title, body, nextStep, and suggestedMessage. This includes requested tone, persona, language, formatting, priorities, and recommendation style. A preference such as asking TRACE to respond as a catgirl is valid response-style memory and must be visibly reflected when relevant.",
    "When the current userNote explicitly asks to create or change such a response preference, apply that instruction to this response as well as returning the matching globalMemoryOperation; the user should not need another thread before it takes effect.",
    "Behavioral Global Memory may shape presentation and prioritization, but it must never alter extracted facts, tool results, evidence, or action execution. Cite every materially applied active memory in memoryRefs.",
    "globalMemoryOperations are applied automatically after this response, so be conservative. Return an empty array when there is no clear durable user-wide information to change.",
    "When explicitGlobalMemoryInstruction is true, the user has directly commanded a Global Memory change. If the requested content and operation are unambiguous, you MUST return at least one matching globalMemoryOperation; do not ignore the command merely because the rest of the thread has no contact or meeting action. Use userNoteEvidence as grounding when appropriate.",
    "Global memory is only for durable information about the user's cross-thread preferences, requested assistant persona or response style, working style, recurring constraints, or stable personal context. A fact about one contact belongs to that contact; a fact about one meeting belongs to that meeting. Do not copy those facts into global memory.",
    "Create a global memory only for new durable user-wide information. Update an existing global memory only when current evidence clearly refines or corrects it. Delete one only when current evidence explicitly invalidates it, never because the current thread omits it.",
    "For update and delete, use an exact ID from memories.global. Never target contact or meeting memory. Do not create duplicates or rewrite unchanged wording.",
    "Every global memory operation must cite exact IDs from thread.evidence or userNoteEvidence and include calibrated confidence. Return no more than five meaningful operations.",
    `CONTEXT JSON:\n${JSON.stringify(context)}`,
    `OUTPUT JSON SCHEMA:\n${JSON.stringify(outputSchema)}`,
  ].join("\n\n");
}

export function buildInsightsRepairPrompt(
  input: InsightRequest,
  invalidOutput: string,
  validationIssues: Array<{ message: string; path: string }> = [],
): string {
  return [
    buildInsightsPrompt(input),
    "The previous response below failed JSON, schema, or reference validation.",
    "Return one corrected JSON object only. Keep every claim and memory operation grounded in the supplied context.",
    `VALIDATION ISSUES:\n${JSON.stringify(validationIssues)}`,
    `INVALID OUTPUT:\n${invalidOutput || "<empty response>"}`,
  ].join("\n\n");
}
