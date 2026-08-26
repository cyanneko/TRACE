import type { ActionCard, CreateContactCard, ToolResult } from "@trace/contracts";

export function isContactAction(action: ActionCard): boolean {
  return action.type === "create_contact" || action.type === "update_contact";
}

export function isMeetingAction(action: ActionCard): boolean {
  return action.type === "create_meeting" || action.type === "update_meeting";
}

export function orderActionsForExecution(actions: ActionCard[]): ActionCard[] {
  return actions
    .map((action, index) => ({ action, index }))
    .sort((left, right) => {
      const priority = Number(isMeetingAction(left.action)) - Number(isMeetingAction(right.action));
      return priority || left.index - right.index;
    })
    .map(({ action }) => action);
}

function normalizedName(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase().replace(/[\s._-]+/g, " ");
}

function contactAliases(action: CreateContactCard): string[] {
  const displayParts = action.payload.displayName.split(/\s+/).filter(Boolean);
  const values = [
    action.payload.displayName,
    action.payload.givenName,
    action.payload.familyName,
    `${action.payload.givenName} ${action.payload.familyName}`,
    `${action.payload.familyName}${action.payload.givenName}`,
    ...displayParts,
  ];
  return [...new Set(values.map(normalizedName).filter((value) => value.length >= 2))];
}

export function linkCreatedContactsToMeeting(
  action: ActionCard,
  confirmedActions: ActionCard[],
  results: ToolResult[],
): ActionCard {
  if (action.type !== "create_meeting" || action.payload.participantNames.length === 0) {
    return action;
  }

  const actionById = new Map(
    confirmedActions
      .filter((candidate): candidate is CreateContactCard => candidate.type === "create_contact")
      .map((candidate) => [candidate.id, candidate]),
  );
  const contactIdsByAlias = new Map<string, Set<string>>();

  for (const result of results) {
    if (!result.success || result.entityRef?.type !== "contact") continue;
    const contactAction = actionById.get(result.actionId);
    if (!contactAction) continue;
    for (const alias of contactAliases(contactAction)) {
      const ids = contactIdsByAlias.get(alias) ?? new Set<string>();
      ids.add(result.entityRef.id);
      contactIdsByAlias.set(alias, ids);
    }
  }

  const linkedIds = action.payload.participantNames.flatMap((name) => {
    const matches = contactIdsByAlias.get(normalizedName(name));
    return matches?.size === 1 ? [...matches] : [];
  });
  if (linkedIds.length === 0) return action;

  return {
    ...action,
    payload: {
      ...action.payload,
      participantContactIds: [...new Set([...action.payload.participantContactIds, ...linkedIds])],
    },
  };
}
