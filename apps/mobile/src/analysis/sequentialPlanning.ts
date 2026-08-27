import {
  ActionCardSchema,
  AnalyzeResultSchema,
  type ActionCard,
  type AnalyzeResult,
  type Evidence,
  type ThreadParticipant,
} from "@trace/contracts";

function isContactAction(action: ActionCard): boolean {
  return action.type === "create_contact" || action.type === "update_contact";
}

function isMeetingAction(action: ActionCard): boolean {
  return action.type === "create_meeting" || action.type === "update_meeting";
}

function sameEvidence(left: Evidence, right: Evidence): boolean {
  return (
    left.quote === right.quote &&
    left.speaker === right.speaker &&
    left.timestampText === right.timestampText
  );
}

function availableId(base: string, used: Set<string>): string {
  if (!used.has(base)) return base;
  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

function mergeEvidence(first: Evidence[], second: Evidence[]) {
  const merged = [...first];
  const byId = new Map(first.map((item) => [item.id, item]));
  const used = new Set(byId.keys());
  const remap = new Map<string, string>();

  for (const item of second) {
    const existing = byId.get(item.id);
    if (!existing) {
      merged.push(item);
      byId.set(item.id, item);
      used.add(item.id);
      remap.set(item.id, item.id);
      continue;
    }
    if (sameEvidence(existing, item)) {
      remap.set(item.id, item.id);
      continue;
    }
    const id = availableId(`meeting-${item.id}`, used);
    merged.push({ ...item, id });
    used.add(id);
    remap.set(item.id, id);
  }
  return { evidence: merged, remap };
}

function remapActionEvidence(action: ActionCard, remap: Map<string, string>): ActionCard {
  return ActionCardSchema.parse({
    ...action,
    evidenceRefs: action.evidenceRefs.map((id) => remap.get(id) ?? id),
    memoryProposals: action.memoryProposals.map((proposal) => ({
      ...proposal,
      evidenceRefs: proposal.evidenceRefs.map((id) => remap.get(id) ?? id),
    })),
  });
}

function mergeParticipants(first: ThreadParticipant[], second: ThreadParticipant[]): ThreadParticipant[] {
  const merged = first.map((participant) => ({ ...participant }));
  const indexByName = new Map(
    merged.map((participant, index) => [participant.displayName.normalize("NFKC").toLocaleLowerCase(), index]),
  );
  for (const participant of second) {
    const key = participant.displayName.normalize("NFKC").toLocaleLowerCase();
    const index = indexByName.get(key);
    if (index === undefined) {
      indexByName.set(key, merged.length);
      merged.push(participant);
      continue;
    }
    const existing = merged[index]!;
    merged[index] = {
      ...existing,
      ...participant,
      contactId: participant.contactId ?? existing.contactId,
      confidence: Math.max(existing.confidence, participant.confidence),
      isSelf: existing.isSelf || participant.isSelf,
    };
  }
  return merged;
}

export function mergeSequentialAnalysis(
  contactAnalysis: AnalyzeResult,
  contactCards: ActionCard[],
  meetingAnalysis: AnalyzeResult,
): AnalyzeResult {
  const { evidence, remap } = mergeEvidence(
    contactAnalysis.thread.evidence,
    meetingAnalysis.thread.evidence,
  );
  const contacts = contactCards.filter(isContactAction);
  const usedActionIds = new Set(contacts.map((action) => action.id));
  const meetings = meetingAnalysis.actionCards.filter(isMeetingAction).map((action) => {
    const remapped = remapActionEvidence(action, remap);
    const id = availableId(remapped.id, usedActionIds);
    usedActionIds.add(id);
    return id === remapped.id ? remapped : ActionCardSchema.parse({ ...remapped, id });
  });

  return AnalyzeResultSchema.parse({
    ...meetingAnalysis,
    runId: contactAnalysis.runId,
    thread: {
      summary: contactAnalysis.thread.summary,
      participants: mergeParticipants(
        contactAnalysis.thread.participants,
        meetingAnalysis.thread.participants,
      ),
      evidence,
      uncertainties: [
        ...new Set([
          ...contactAnalysis.thread.uncertainties,
          ...meetingAnalysis.thread.uncertainties,
        ]),
      ],
    },
    actionCards: [...contacts, ...meetings],
  });
}
