import { AnalyzeModelOutputSchema, type AnalyzeRequest } from "@trace/contracts";
import { z } from "zod";

const outputSchema = z.toJSONSchema(AnalyzeModelOutputSchema);

export function buildAnalyzePrompt(input: AnalyzeRequest): string {
  const context = {
    currentTime: input.currentTime,
    timezone: input.timezone,
    userNote: input.note,
    contacts: input.contacts,
    activeMemories: input.memories.filter((memory) => memory.status === "active"),
  };

  return [
    "Analyze this chat screenshot and return JSON only.",
    "Extract only claims supported by visible screenshot evidence or supplied context.",
    "Propose at most three actions. Allowed action types: create_meeting, create_contact, update_contact.",
    "Do not execute anything. Do not invent missing dates, contact matches, phone numbers, emails, companies, or roles.",
    "Every action must reference one or more evidence IDs from thread.evidence.",
    "If a meeting date or time is incomplete, use null and add a risk flag instead of guessing.",
    "An update_contact action needs an unambiguous contactId; otherwise set contactId to null and add a risk flag.",
    `CONTEXT JSON:\n${JSON.stringify(context)}`,
    `OUTPUT JSON SCHEMA:\n${JSON.stringify(outputSchema)}`,
  ].join("\n\n");
}

export function buildRepairPrompt(input: AnalyzeRequest, invalidOutput: string): string {
  return [
    buildAnalyzePrompt(input),
    "The previous response below failed JSON/schema validation.",
    "Return one corrected JSON object only. Preserve only facts grounded in the screenshot and context.",
    `INVALID OUTPUT:\n${invalidOutput || "<empty response>"}`,
  ].join("\n\n");
}
