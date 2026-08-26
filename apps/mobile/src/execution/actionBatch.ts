import type {
  ActionCard,
  ContactRecord,
  CreateContactCard,
  MeetingRecord,
  ToolResult,
} from "@trace/contracts";

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

const selfAliases = ["Me", "Myself", "I", "User", "我", "我自己", "本人", "自己", "用户"].map(
  normalizedName,
);

function aliasesFromIdentity(
  displayName: string,
  givenName: string,
  familyName: string,
  isSelf: boolean,
): string[] {
  const displayParts = displayName.split(/\s+/).filter(Boolean);
  const values = [
    displayName,
    givenName,
    familyName,
    `${givenName} ${familyName}`,
    `${familyName}${givenName}`,
    ...displayParts,
    ...(isSelf ? selfAliases : []),
  ];
  return [...new Set(values.map(normalizedName).filter(Boolean))];
}

function contactAliases(action: CreateContactCard): string[] {
  return aliasesFromIdentity(
    action.payload.displayName,
    action.payload.givenName,
    action.payload.familyName,
    action.payload.isSelf,
  );
}

function recordAliases(contact: ContactRecord): string[] {
  return aliasesFromIdentity(
    contact.displayName,
    contact.givenName ?? "",
    contact.familyName ?? "",
    contact.isSelf,
  );
}

function addAliases(index: Map<string, Set<string>>, contactId: string, aliases: string[]) {
  for (const alias of aliases) {
    const ids = index.get(alias) ?? new Set<string>();
    ids.add(contactId);
    index.set(alias, ids);
  }
}

export function linkContactsToMeetingAction(
  action: ActionCard,
  confirmedActions: ActionCard[],
  results: ToolResult[],
  contacts: ContactRecord[] = [],
  existingMeeting: MeetingRecord | null = null,
): ActionCard {
  if (action.type !== "create_meeting" && action.type !== "update_meeting") {
    return action;
  }
  const participantNames = action.payload.participantNames;
  if (participantNames.length === 0) return action;
  const canonicalContactId = (contactId: string) =>
    contacts.find(
      (contact) => contact.id === contactId || contact.externalContactId === contactId,
    )?.id ?? contactId;

  const actionById = new Map(
    confirmedActions
      .filter((candidate): candidate is CreateContactCard => candidate.type === "create_contact")
      .map((candidate) => [candidate.id, candidate]),
  );
  const contactIdsByAlias = new Map<string, Set<string>>();

  for (const contact of contacts) {
    addAliases(contactIdsByAlias, contact.id, recordAliases(contact));
  }

  for (const result of results) {
    if (!result.success || result.entityRef?.type !== "contact") continue;
    const contactAction = actionById.get(result.actionId);
    if (!contactAction) continue;
    addAliases(contactIdsByAlias, result.entityRef.id, contactAliases(contactAction));
  }

  const linkedIds = participantNames.flatMap((name) => {
    const matches = contactIdsByAlias.get(normalizedName(name));
    return matches?.size === 1 ? [...matches] : [];
  });
  if (linkedIds.length === 0) return action;

  if (action.type === "update_meeting") {
    const participantChangeIndex = action.payload.changes.findIndex(
      (change) => change.field === "participantContactIds",
    );
    if (participantChangeIndex < 0 && !existingMeeting) return action;
    const existingIds = existingMeeting?.participantContactIds ?? [];
    const changes =
      participantChangeIndex >= 0
        ? action.payload.changes.map((change, index) =>
            index === participantChangeIndex && change.field === "participantContactIds"
              ? {
                  ...change,
                  nextValue: [
                    ...new Set([...change.nextValue.map(canonicalContactId), ...linkedIds]),
                  ],
                }
              : change,
          )
        : [
            ...action.payload.changes,
            {
              field: "participantContactIds" as const,
              previousValue: existingIds,
              nextValue: [...new Set([...existingIds, ...linkedIds])],
            },
          ];
    return { ...action, payload: { ...action.payload, changes } };
  }

  return {
    ...action,
    payload: {
      ...action.payload,
      participantContactIds: [
        ...new Set([
          ...action.payload.participantContactIds.map(canonicalContactId),
          ...linkedIds,
        ]),
      ],
    },
  };
}
