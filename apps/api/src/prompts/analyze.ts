import { AnalyzeModelOutputSchema, type AnalyzeRequest } from "@trace/contracts";
import { z } from "zod";

const outputSchema = z.toJSONSchema(AnalyzeModelOutputSchema);

export function buildAnalyzePrompt(input: AnalyzeRequest): string {
  const context = {
    currentTime: input.currentTime,
    timezone: input.timezone,
    userNote: input.note,
    contacts: input.contacts,
    meetings: input.meetings,
    entityMemories: input.entityMemories.filter((memory) => memory.status === "active"),
    legacyMemories: input.memories.filter((memory) => memory.status === "active"),
  };

  return [
    "You are TRACE's perception and planning agent. Analyze the chat screenshot and return one JSON object only.",
    "Use only claims supported by visible screenshot evidence or supplied context. Never execute actions.",
    "Return every distinct executable action supported by the conversation. There is no business count limit; do not merge unrelated actions or silently truncate them.",
    "Allowed action types are create_meeting, update_meeting, create_contact, and update_contact. Deduplicate repeated statements about the same change.",
    "Every action must reference one or more IDs from thread.evidence, and action IDs must be unique.",
    "Do not invent dates, contact matches, names, phone numbers, emails, companies, roles, meeting IDs, or participant IDs.",
    "Resolve relative dates using currentTime and timezone only when the screenshot supplies enough information. Otherwise use null and add a risk flag.",
    "For a new person, propose create_contact when a visible name, handle, or stable alias directly interacts with the user through a reply, agreement, invitation, task, information exchange, or follow-up intent.",
    "A create_contact payload requires only displayName. Keep unknown optional identity fields as empty strings or arrays. Do not create contacts for people merely mentioned, forwarded content, system accounts, bots, or the user themself.",
    "When a possible existing contact is ambiguous, add possible_duplicate to riskFlags rather than pretending the match is certain.",
    "An update_contact action needs an unambiguous contactId from context; otherwise set contactId to null and add a risk flag.",
    "Use update_meeting when the screenshot changes an existing meeting's title, time, timezone, location, link, notes, or participantContactIds.",
    "An update_meeting action must use a meetingId from context. If several meetings could match, set meetingId to null, add a risk flag, and preserve the proposed changes for user selection.",
    "Meeting participantContactIds must come from supplied contacts. Keep unmatched visible participants in participantNames and, when direct interaction qualifies, propose separate create_contact actions.",
    "memoryProposals are optional and must contain durable, evidence-backed context, preferences, commitments, or notes. Do not duplicate basic fields such as names, phone numbers, job titles, meeting titles, or meeting times as free memory.",
    "Use target type action_entity for memory belonging to a newly created or updated primary entity. Use explicit contact or meeting targets only when the ID is supplied in context.",
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
