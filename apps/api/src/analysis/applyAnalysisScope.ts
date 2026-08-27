import {
  AnalyzeModelOutputSchema,
  type ActionCard,
  type AnalyzeModelOutput,
  type AnalyzeRequest,
  type Evidence,
  type ThreadParticipant,
} from "@trace/contracts";

function isContactAction(action: ActionCard): boolean {
  return action.type === "create_contact" || action.type === "update_contact";
}

function isMeetingAction(action: ActionCard): boolean {
  return action.type === "create_meeting" || action.type === "update_meeting";
}

function withRisk(riskFlags: string[], risk: string): string[] {
  return riskFlags.includes(risk) ? riskFlags : [...riskFlags, risk];
}

function withoutRisk(riskFlags: string[], risk: string): string[] {
  return riskFlags.filter((flag) => flag !== risk);
}

function normalized(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase().replace(/[\s._-]+/g, " ");
}

const selfSpeakerAliases = new Set(["user", "me", "myself", "i", "用户", "我", "本人", "自己"]);

function identityAliases(identity: {
  displayName: string;
  familyName?: string;
  givenName?: string;
  isSelf?: boolean;
}): string[] {
  const displayParts = identity.displayName.split(/\s+/).filter(Boolean);
  const values = [
    identity.displayName,
    identity.givenName ?? "",
    identity.familyName ?? "",
    `${identity.givenName ?? ""} ${identity.familyName ?? ""}`,
    `${identity.familyName ?? ""}${identity.givenName ?? ""}`,
    ...displayParts,
    ...(identity.isSelf ? [...selfSpeakerAliases] : []),
  ];
  return [...new Set(values.map(normalized).filter(Boolean))];
}

function addNameAliases(index: Map<string, Set<string>>, id: string, aliases: string[]) {
  for (const alias of aliases) {
    const ids = index.get(alias) ?? new Set<string>();
    ids.add(id);
    index.set(alias, ids);
  }
}

function uniqueNameMatch(index: Map<string, Set<string>>, value: string): string | undefined {
  const matches = index.get(normalized(value));
  return matches?.size === 1 ? [...matches][0] : undefined;
}

function missingUpdateAsContact(
  action: Extract<ActionCard, { type: "update_contact" }>,
  participant: ThreadParticipant,
  memoryProposals: ActionCard["memoryProposals"],
): ActionCard {
  let displayName = action.payload.displayName;
  let givenName = "";
  let familyName = "";
  let company = "";
  let jobTitle = "";
  let phones: string[] = [];
  let emails: string[] = [];
  let isSelf = Boolean(participant.isSelf);

  for (const change of action.payload.changes) {
    if (change.field === "displayName") displayName = change.nextValue ?? displayName;
    if (change.field === "givenName") givenName = change.nextValue ?? "";
    if (change.field === "familyName") familyName = change.nextValue ?? "";
    if (change.field === "company") company = change.nextValue ?? "";
    if (change.field === "jobTitle") jobTitle = change.nextValue ?? "";
    if (change.field === "phones") phones = change.nextValue;
    if (change.field === "emails") emails = change.nextValue;
    if (change.field === "isSelf") isSelf = change.nextValue;
  }

  return {
    ...action,
    type: "create_contact",
    title: isSelf ? "Create my contact" : `Create ${displayName}`,
    editableFields: [
      "displayName",
      "givenName",
      "familyName",
      "company",
      "jobTitle",
      "phones",
      "emails",
      "isSelf",
    ],
    riskFlags: withRisk(withoutRisk(action.riskFlags, "contact_not_found"), "previous_contact_missing"),
    memoryProposals,
    payload: {
      displayName,
      givenName,
      familyName,
      company,
      jobTitle,
      phones,
      emails,
      isSelf,
      interactionSummary: "",
    },
  };
}

function reconcileEntityReferences(input: AnalyzeRequest, output: AnalyzeModelOutput): AnalyzeModelOutput {
  const contactAliases = new Map<string, string>();
  const contactIdsByName = new Map<string, Set<string>>();
  for (const contact of input.contacts) {
    contactAliases.set(contact.id, contact.id);
    if (contact.externalContactId) contactAliases.set(contact.externalContactId, contact.id);
    addNameAliases(contactIdsByName, contact.id, identityAliases(contact));
  }
  const meetingAliases = new Map<string, string>();
  const meetingIdsByTitle = new Map<string, Set<string>>();
  for (const meeting of input.meetings) {
    meetingAliases.set(meeting.id, meeting.id);
    if (meeting.externalEventId) meetingAliases.set(meeting.externalEventId, meeting.id);
    addNameAliases(meetingIdsByTitle, meeting.id, [normalized(meeting.title)]);
  }
  const resolveContactId = (id: string) => contactAliases.get(id);
  const resolveMeetingId = (id: string) => meetingAliases.get(id);
  const resolveContactName = (name: string) => uniqueNameMatch(contactIdsByName, name);
  const resolveMeetingTitle = (title: string) => uniqueNameMatch(meetingIdsByTitle, title);
  const directParticipant = (displayName: string) =>
    output.thread.participants.find(
      (participant) => normalized(participant.displayName) === normalized(displayName),
    );
  const participants = output.thread.participants.map((participant) => {
    const contactId =
      (participant.contactId ? resolveContactId(participant.contactId) : undefined) ??
      resolveContactName(participant.displayName);
    if (contactId) return { ...participant, contactId };
    if (!participant.contactId) return participant;
    const { contactId: _invalidContactId, ...unmatched } = participant;
    return unmatched;
  });
  const actionCards = output.actionCards.map((action): ActionCard => {
    const validMemoryProposals = action.memoryProposals.flatMap((proposal) => {
      if (proposal.target.type === "action_entity") return [proposal];
      if (proposal.target.type === "contact") {
        const contactId = resolveContactId(proposal.target.contactId);
        return contactId ? [{ ...proposal, target: { type: "contact" as const, contactId } }] : [];
      }
      const meetingId = resolveMeetingId(proposal.target.meetingId);
      return meetingId ? [{ ...proposal, target: { type: "meeting" as const, meetingId } }] : [];
    });

    if (action.type === "create_contact") {
      return { ...action, memoryProposals: validMemoryProposals };
    }
    if (action.type === "update_contact") {
      const contactId =
        (action.payload.contactId ? resolveContactId(action.payload.contactId) : undefined) ??
        resolveContactName(action.payload.displayName);
      const participant = directParticipant(action.payload.displayName);
      const hasNameCandidates = Boolean(
        contactIdsByName.get(normalized(action.payload.displayName))?.size,
      );
      if (action.payload.contactId && !contactId && participant && !hasNameCandidates) {
        return missingUpdateAsContact(action, participant, validMemoryProposals);
      }
      return {
        ...action,
        memoryProposals: validMemoryProposals,
        riskFlags: contactId
          ? withoutRisk(action.riskFlags, "contact_not_found")
          : withRisk(action.riskFlags, "contact_not_found"),
        payload: { ...action.payload, contactId: contactId ?? null },
      };
    }
    if (action.type === "create_meeting") {
      const resolvedNames = action.payload.participantNames.flatMap((name) => {
        const contactId = resolveContactName(name);
        return contactId ? [contactId] : [];
      });
      const participantContactIds = [
        ...new Set([
          ...action.payload.participantContactIds.flatMap((id) => resolveContactId(id) ?? []),
          ...resolvedNames,
        ]),
      ];
      const unresolvedIdCount = action.payload.participantContactIds.filter(
        (id) => !resolveContactId(id),
      ).length;
      const unresolvedNameCount = action.payload.participantNames.filter(
        (name) => !resolveContactName(name),
      ).length;
      const missingParticipant =
        unresolvedNameCount > 0 || unresolvedIdCount > resolvedNames.length;
      return {
        ...action,
        memoryProposals: validMemoryProposals,
        riskFlags: missingParticipant
          ? withRisk(action.riskFlags, "contact_not_found")
          : withoutRisk(action.riskFlags, "contact_not_found"),
        payload: { ...action.payload, participantContactIds },
      };
    }

    const meetingId =
      (action.payload.meetingId ? resolveMeetingId(action.payload.meetingId) : undefined) ??
      resolveMeetingTitle(action.payload.displayTitle);
    const resolvedParticipantIds = action.payload.participantNames.flatMap((name) => {
      const contactId = resolveContactName(name);
      return contactId ? [contactId] : [];
    });
    let unresolvedNextIdCount = 0;
    let missingParticipant = action.payload.participantNames.some((name) => !resolveContactName(name));
    let hasParticipantChange = false;
    const changes = action.payload.changes.map((change) => {
      if (change.field !== "participantContactIds") return change;
      hasParticipantChange = true;
      const previousValue = [...new Set(change.previousValue.flatMap((id) => resolveContactId(id) ?? []))];
      const nextValue = [
        ...new Set([
          ...change.nextValue.flatMap((id) => resolveContactId(id) ?? []),
          ...resolvedParticipantIds,
        ]),
      ];
      unresolvedNextIdCount += change.nextValue.filter((id) => !resolveContactId(id)).length;
      return { ...change, previousValue, nextValue };
    });
    missingParticipant ||= unresolvedNextIdCount > resolvedParticipantIds.length;
    if (!hasParticipantChange && resolvedParticipantIds.length > 0) {
      const existingParticipantIds = input.meetings.find((meeting) => meeting.id === meetingId)
        ?.participantContactIds.flatMap((id) => resolveContactId(id) ?? []) ?? [];
      const nextValue = [...new Set([...existingParticipantIds, ...resolvedParticipantIds])];
      if (nextValue.length !== existingParticipantIds.length) {
        changes.push({
          field: "participantContactIds",
          previousValue: existingParticipantIds,
          nextValue,
        });
      }
    }
    let riskFlags = action.riskFlags;
    riskFlags = meetingId
      ? withoutRisk(riskFlags, "meeting_not_found")
      : withRisk(riskFlags, "meeting_not_found");
    riskFlags = missingParticipant
      ? withRisk(riskFlags, "contact_not_found")
      : withoutRisk(riskFlags, "contact_not_found");
    return {
      ...action,
      memoryProposals: validMemoryProposals,
      riskFlags,
      payload: {
        ...action.payload,
        meetingId: meetingId ?? null,
        changes,
      },
    };
  });

  return { ...output, thread: { ...output.thread, participants }, actionCards };
}

function selfEvidence(participant: ThreadParticipant, evidence: Evidence[]): Evidence[] {
  const displayName = normalized(participant.displayName);
  const hasGroundedName = !selfSpeakerAliases.has(displayName);
  return evidence.filter((item) => {
    const speaker = normalized(item.speaker ?? "");
    const quote = normalized(item.quote);
    return (
      speaker === displayName ||
      selfSpeakerAliases.has(speaker) ||
      (hasGroundedName && quote.includes(displayName))
    );
  });
}

function uniqueActionId(actions: ActionCard[], base: string): string {
  const used = new Set(actions.map((action) => action.id));
  if (!used.has(base)) return base;
  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

function inferredSelfParticipant(output: AnalyzeModelOutput): ThreadParticipant | undefined {
  const explicit = output.thread.participants.find((participant) => participant.isSelf);
  if (explicit) return explicit;
  return output.thread.participants.find((participant) => {
    const displayName = normalized(participant.displayName);
    if (selfSpeakerAliases.has(displayName)) return false;
    return output.thread.evidence.some((item) => {
      if (!selfSpeakerAliases.has(normalized(item.speaker ?? ""))) return false;
      const quote = normalized(item.quote);
      const compactQuote = quote.replace(/\s+/g, "");
      const compactName = displayName.replace(/\s+/g, "");
      const englishIntroduction = [
        `i am ${displayName}`,
        `i'm ${displayName}`,
        `my name is ${displayName}`,
        `call me ${displayName}`,
      ].some((phrase) => quote.includes(phrase));
      const chineseIntroduction = [`我是${compactName}`, `我叫${compactName}`, `叫我${compactName}`].some(
        (phrase) => compactQuote.includes(phrase),
      );
      return englishIntroduction || chineseIntroduction;
    });
  });
}

function ensureSelfContact(input: AnalyzeRequest, output: AnalyzeModelOutput): AnalyzeModelOutput {
  const participant = inferredSelfParticipant(output);
  if (!participant) return output;
  const markedOutput = participant.isSelf
    ? output
    : {
        ...output,
        thread: {
          ...output.thread,
          participants: output.thread.participants.map((item) =>
            item === participant ? { ...item, isSelf: true } : item,
          ),
        },
      };
  if (input.contacts.some((contact) => contact.isSelf)) return markedOutput;
  if (output.actionCards.some((action) => action.type === "create_contact" && action.payload.isSelf)) {
    return markedOutput;
  }
  const evidence = selfEvidence(participant, output.thread.evidence);
  if (evidence.length === 0) return markedOutput;

  const placeholder = selfSpeakerAliases.has(normalized(participant.displayName));
  return {
    ...markedOutput,
    actionCards: [
      ...markedOutput.actionCards,
      {
        id: uniqueActionId(markedOutput.actionCards, "action-create-self"),
        type: "create_contact",
        title: "Create my contact",
        confidence: participant.confidence,
        evidenceRefs: evidence.map((item) => item.id),
        editableFields: ["displayName", "givenName", "familyName", "phones", "emails", "isSelf"],
        riskFlags: placeholder ? ["identity_incomplete"] : [],
        memoryProposals: [],
        payload: {
          displayName: participant.displayName,
          givenName: "",
          familyName: "",
          company: "",
          jobTitle: "",
          phones: [],
          emails: [],
          isSelf: true,
          interactionSummary: `The user identifies themself as ${participant.displayName} in this thread.`,
        },
      },
    ],
  };
}

const unusableContactNames = new Set([
  "unknown",
  "unknown contact",
  "someone",
  "unnamed",
  "person",
  "对方",
  "未知",
  "未知联系人",
]);

function participantEvidence(participant: ThreadParticipant, evidence: Evidence[]): Evidence[] {
  const aliases = new Set(identityAliases(participant));
  return evidence.filter((item) => {
    const speaker = normalized(item.speaker ?? "");
    const quote = normalized(item.quote);
    return aliases.has(speaker) || [...aliases].some((alias) => quote.includes(alias));
  });
}

function contactActionDisplayName(action: ActionCard): string | undefined {
  if (action.type === "create_contact") return action.payload.displayName;
  if (action.type === "update_contact") return action.payload.displayName;
  return undefined;
}

function ensureDirectParticipantContacts(
  input: AnalyzeRequest,
  output: AnalyzeModelOutput,
  groundingActions: ActionCard[],
): AnalyzeModelOutput {
  const knownAliases = new Set(input.contacts.flatMap((contact) => identityAliases(contact)));
  const actionCards = [...output.actionCards];

  for (const participant of output.thread.participants) {
    const participantName = normalized(participant.displayName);
    if (
      participant.contactId ||
      participant.isSelf ||
      selfSpeakerAliases.has(participantName) ||
      unusableContactNames.has(participantName)
    ) {
      continue;
    }
    const aliases = identityAliases(participant);
    if (aliases.some((alias) => knownAliases.has(alias))) continue;

    const evidence = participantEvidence(participant, output.thread.evidence);
    if (evidence.length === 0) continue;
    const evidenceIds = new Set(evidence.map((item) => item.id));
    const actionGrounded = groundingActions.some(
      (action) =>
        isMeetingAction(action) && action.evidenceRefs.some((evidenceId) => evidenceIds.has(evidenceId)),
    );
    const evidenceText = evidence.map((item) => normalized(item.quote)).join(" ");
    const identityOrFollowUpGrounded =
      /(^|\s)(i am|i'm|my name is|email|phone|company|role|meet|meeting|interview|appointment|review|tomorrow|next week)(\s|$)/i.test(
        evidenceText,
      ) ||
      /我是|我叫|邮箱|电话|公司|职位|负责|合作|联系|跟进|会议|面试|评审|明天|下周|安排|邀请/.test(
        evidenceText,
      );
    if (!actionGrounded && !identityOrFollowUpGrounded) continue;
    const alreadyRepresented = actionCards.some((action) => {
      const displayName = contactActionDisplayName(action);
      if (!displayName) return false;
      return (
        aliases.includes(normalized(displayName)) ||
        action.evidenceRefs.some((evidenceId) => evidenceIds.has(evidenceId))
      );
    });
    if (alreadyRepresented) continue;

    actionCards.push({
      id: uniqueActionId(actionCards, `action-create-${participantName.replace(/\s+/g, "-")}`),
      type: "create_contact",
      title: `Create ${participant.displayName}`,
      confidence: participant.confidence,
      evidenceRefs: evidence.map((item) => item.id),
      editableFields: [
        "displayName",
        "givenName",
        "familyName",
        "company",
        "jobTitle",
        "phones",
        "emails",
        "isSelf",
      ],
      riskFlags: [],
      memoryProposals: [],
      payload: {
        displayName: participant.displayName,
        givenName: "",
        familyName: "",
        company: "",
        jobTitle: "",
        phones: [],
        emails: [],
        isSelf: false,
        interactionSummary: "",
      },
    });
  }

  return { ...output, actionCards };
}

export function applyAnalysisScope(input: AnalyzeRequest, output: AnalyzeModelOutput): AnalyzeModelOutput {
  const reconciled = reconcileEntityReferences(input, output);
  const scoped = {
    ...reconciled,
    actionCards:
      input.actionScope === "contacts"
        ? reconciled.actionCards.filter(isContactAction)
        : input.actionScope === "meetings"
          ? reconciled.actionCards.filter(isMeetingAction)
          : reconciled.actionCards,
  };
  const recovered = input.actionScope === "contacts"
    ? ensureDirectParticipantContacts(input, ensureSelfContact(input, scoped), reconciled.actionCards)
    : input.actionScope === "meetings"
      ? scoped
      : ensureSelfContact(input, scoped);
  return AnalyzeModelOutputSchema.parse(recovered);
}
