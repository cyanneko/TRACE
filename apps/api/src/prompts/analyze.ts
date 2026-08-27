import { AnalyzeModelOutputSchema, type AnalyzeRequest } from "@trace/contracts";
import { z } from "zod";

const outputSchema = z.toJSONSchema(AnalyzeModelOutputSchema);

export function buildAnalyzePrompt(input: AnalyzeRequest): string {
  const scopeInstruction = {
    all: "Return every grounded contact and meeting action.",
    contacts:
      "This is CONTACT PASS 1. actionCards may contain only create_contact and update_contact. Extract the complete thread, including all meeting evidence, but do not return meeting actions yet. Every directly interacting unmatched participant, including the user, needs a contact action.",
    meetings:
      "This is MEETING PASS 2. actionCards may contain only create_meeting and update_meeting. The supplied contacts are the confirmed result of pass 1. Use their IDs for attendees and do not return contact actions. If the screenshot, description, or priorThread grounds an agreement, invitation, interview, appointment, or intention to meet, return the corresponding meeting action even when its time or other fields are incomplete; keep unresolved fields null and add risk flags. Return no meeting action only when there is genuinely no grounded meeting or meeting change.",
  }[input.actionScope];
  const context = {
    actionScope: input.actionScope,
    currentTime: input.currentTime,
    timezone: input.timezone,
    userNote: input.note,
    contacts: input.contacts,
    meetings: input.meetings,
    entityMemories: input.entityMemories.filter((memory) => memory.status === "active"),
    legacyMemories: input.memories.filter((memory) => memory.status === "active"),
    inputMode: input.screenshotDataUrl ? "screenshot_with_optional_description" : "description_only",
    priorThread: input.priorThread,
    reviewFeedback: input.reviewFeedback,
  };

  return [
    "You are TRACE's perception and planning agent. Analyze the supplied chat screenshot and/or user description, then return one JSON object only.",
    "Use only claims supported by the screenshot, user description, or supplied entity context. Never execute actions.",
    scopeInstruction,
    "Within the requested action scope, return every distinct executable action supported by the conversation. There is no business count limit; do not merge unrelated actions or silently truncate them.",
    "Allowed action types are create_meeting, update_meeting, create_contact, and update_contact. Deduplicate repeated statements about the same change.",
    "thread.participants must include every direct participant and the user when visible or described. Set isSelf true only for the user's own identity, using message direction, first-person self-introduction, or the user description as evidence. Set isSelf false for everyone else.",
    "When priorThread is supplied, preserve its grounded facts and evidence IDs wherever they still describe the same screenshot content.",
    "When reviewFeedback is supplied, revise only the requested planning pass to address it. Treat feedback as explicit user clarification that may disambiguate speakers or intent, but do not infer facts beyond the feedback and other supplied context.",
    "Every action must reference one or more IDs from thread.evidence, and action IDs must be unique.",
    "Do not invent dates, contact matches, names, phone numbers, emails, companies, roles, meeting IDs, or participant IDs.",
    "Resolve relative dates using currentTime and timezone only when the supplied conversation context has enough information. Otherwise use null and add a risk flag.",
    "All startAt and endAt values must be UTC ISO 8601 timestamps ending in Z. Convert local times using the supplied timezone.",
    "For a new person, propose create_contact when a supplied name, handle, or stable alias directly interacts with the user through a reply, agreement, invitation, task, information exchange, or follow-up intent.",
    "For each thread participant, use a supplied contact ID only when the match is grounded. Omit contactId entirely when unmatched; never return contactId as null or an empty string.",
    "A contact with isSelf true represents the user. Reuse a supplied isSelf contact instead of creating a duplicate.",
    "In the contacts pass, when the user names themself in the conversation and no supplied isSelf contact exists, always propose create_contact with isSelf true. Also do this when a later meeting needs the user as a participant. Use a grounded name when available; otherwise use the reserved editable placeholder Me and add identity_incomplete to riskFlags.",
    "A create_contact payload requires only displayName. Keep unknown optional identity fields as empty strings or arrays. Do not create contacts for people merely mentioned, forwarded content, system accounts, or bots.",
    "When a possible existing contact is ambiguous, add possible_duplicate to riskFlags rather than pretending the match is certain.",
    "An update_contact action needs an unambiguous contactId from context; otherwise set contactId to null and add a risk flag. Contact changes may update displayName, givenName, familyName, company, jobTitle, complete phones and emails lists, or isSelf. Emit every concrete field change supported by the evidence, with at most one change per field; do not reduce a structured profile change to free-text memory.",
    "Use update_meeting when the screenshot changes an existing meeting's title, startAt, endAt, timezone, allDay state, location, link, or participantContactIds. Emit every concrete field change supported by the evidence; never encode a reschedule only as free-text memory.",
    "When a meeting is moved to a new time, always emit a startAt change. If its prior duration is known and the conversation does not change that duration, also emit the corresponding endAt change that preserves it.",
    "An update_meeting action must use a meetingId from context. If several meetings could match, set meetingId to null, add a risk flag, and preserve the proposed changes for user selection.",
    "Meetings must include every attendee, including the user. Use the supplied isSelf contact ID for the user when available.",
    "Meeting participantContactIds must come from supplied contacts. Keep unmatched participants in participantNames. Contact actions for those people belong only to the contacts pass; never emit them during the meetings pass.",
    "For update_meeting, put pending names in payload.participantNames. Preserve known IDs in a participantContactIds change; TRACE resolves pending names only after their contact actions succeed.",
    "memoryProposals are the only place for durable free-text context about a contact or meeting. Use them for evidence-backed relationship context, commitments, preferences, preparation, or decisions worth remembering. Do not classify memories or duplicate basic fields such as names, phone numbers, job titles, meeting titles, or meeting times as free memory.",
    "Use target type action_entity for memory belonging to a newly created or updated primary entity. Use explicit contact or meeting targets only when the ID is supplied in context. Never propose Global Memory here; TRACE consolidates it only after all confirmed contact and meeting actions finish.",
    `CONTEXT JSON:\n${JSON.stringify(context)}`,
    `OUTPUT JSON SCHEMA:\n${JSON.stringify(outputSchema)}`,
  ].join("\n\n");
}

export function buildRepairPrompt(
  input: AnalyzeRequest,
  invalidOutput: string,
  validationIssues: Array<{ message: string; path: string }> = [],
): string {
  return [
    buildAnalyzePrompt(input),
    "The previous response below failed JSON/schema validation.",
    "Return one corrected JSON object only. Preserve only facts grounded in the supplied conversation and context.",
    `VALIDATION ISSUES:\n${JSON.stringify(validationIssues)}`,
    `INVALID OUTPUT:\n${invalidOutput || "<empty response>"}`,
  ].join("\n\n");
}
