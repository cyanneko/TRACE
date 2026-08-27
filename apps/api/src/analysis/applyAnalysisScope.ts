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

function normalized(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

const selfSpeakerAliases = new Set(["user", "me", "myself", "i", "用户", "我", "本人", "自己"]);

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

export function applyAnalysisScope(input: AnalyzeRequest, output: AnalyzeModelOutput): AnalyzeModelOutput {
  const scoped = {
    ...output,
    actionCards:
      input.actionScope === "contacts"
        ? output.actionCards.filter(isContactAction)
        : input.actionScope === "meetings"
          ? output.actionCards.filter(isMeetingAction)
          : output.actionCards,
  };
  const recovered = input.actionScope === "meetings" ? scoped : ensureSelfContact(input, scoped);
  return AnalyzeModelOutputSchema.parse(recovered);
}
