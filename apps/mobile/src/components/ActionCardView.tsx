import type { ActionCard, ContactRecord, Evidence, MeetingRecord } from "@trace/contracts";
import {
  CalendarClock,
  CalendarPlus,
  Check,
  CheckSquare2,
  ChevronDown,
  Square,
  UserPen,
  UserPlus,
} from "lucide-react-native";
import { type ComponentType, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";

import { colors } from "../theme";
import { DateTimeField } from "./DateTimeField";

type Props = {
  card: ActionCard;
  contacts: ContactRecord[];
  evidence: Evidence[];
  meetings: MeetingRecord[];
  onChange: (card: ActionCard) => void;
  onToggle: () => void;
  selected: boolean;
};

const cardMeta: Record<
  ActionCard["type"],
  { icon: ComponentType<{ color?: string; size?: number; strokeWidth?: number }>; label: string }
> = {
  create_meeting: { icon: CalendarPlus, label: "Meeting" },
  update_meeting: { icon: CalendarClock, label: "Meeting update" },
  create_contact: { icon: UserPlus, label: "New contact" },
  update_contact: { icon: UserPen, label: "Contact update" },
};

export function ActionCardView({ card, contacts, evidence, meetings, onChange, onToggle, selected }: Props) {
  const meta = cardMeta[card.type];
  const Icon = meta.icon;
  const confidence = Math.round(card.confidence * 100);
  const kindLabel = card.type === "create_contact" && card.payload.isSelf ? "My contact" : meta.label;

  return (
    <View style={[styles.card, !selected && styles.cardUnselected]}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel={selected ? `Exclude ${card.title}` : `Include ${card.title}`}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: selected }}
          hitSlop={8}
          onPress={onToggle}
          style={styles.checkbox}
        >
          {selected ? (
            <CheckSquare2 color={colors.primary} size={23} strokeWidth={2.1} />
          ) : (
            <Square color={colors.textMuted} size={23} strokeWidth={1.8} />
          )}
        </Pressable>
        <View style={styles.iconBox}>
          <Icon color={colors.blue} size={19} strokeWidth={2} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.kind}>{kindLabel}</Text>
          <Text style={styles.title}>{card.title}</Text>
        </View>
        <View style={[styles.confidence, confidence < 80 && styles.confidenceCaution]}>
          <Text style={[styles.confidenceText, confidence < 80 && styles.confidenceTextCaution]}>
            {confidence}%
          </Text>
        </View>
      </View>

      {selected ? <Fields card={card} contacts={contacts} meetings={meetings} onChange={onChange} /> : null}

      {card.riskFlags.length > 0 ? (
        <View style={styles.risks}>
          {card.riskFlags.map((risk) => (
            <Text key={risk} style={styles.riskText}>
              {risk.replaceAll("_", " ")}
            </Text>
          ))}
        </View>
      ) : null}

      {evidence.length > 0 ? (
        <View style={styles.evidence}>
          <Text style={styles.evidenceLabel}>Evidence</Text>
          {evidence.map((item) => (
            <Text key={item.id} style={styles.quote}>
              “{item.quote}”
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function Fields({ card, contacts, meetings, onChange }: Pick<Props, "card" | "contacts" | "meetings" | "onChange">) {
  if (card.type === "create_meeting") {
    const updateStartAt = (startAt: string | undefined) => {
      if (!startAt) {
        onChange({ ...card, payload: { ...card.payload, startAt: null } });
        return;
      }
      const previousStart = card.payload.startAt ? new Date(card.payload.startAt) : null;
      const previousEnd = card.payload.endAt ? new Date(card.payload.endAt) : null;
      const duration =
        previousStart && previousEnd
          ? Math.max(0, previousEnd.getTime() - previousStart.getTime())
          : 30 * 60 * 1_000;
      onChange({
        ...card,
        payload: {
          ...card.payload,
          startAt,
          endAt: new Date(new Date(startAt).getTime() + duration).toISOString(),
        },
      });
    };
    return (
      <View style={styles.fields}>
        <Field
          label="Title"
          onChangeText={(title) => onChange({ ...card, payload: { ...card.payload, title } })}
          value={card.payload.title}
        />
        <View style={styles.fieldRow}>
          <DateTimeField
            label="Starts"
            onChange={updateStartAt}
            timezone={card.payload.timezone}
            value={card.payload.startAt ?? undefined}
          />
          <DateTimeField
            label="Ends"
            onChange={(endAt) =>
              onChange({ ...card, payload: { ...card.payload, endAt: endAt ?? null } })
            }
            timezone={card.payload.timezone}
            value={card.payload.endAt ?? undefined}
          />
        </View>
        <MeetingParticipantsField
          contactIds={card.payload.participantContactIds}
          contacts={contacts}
          onChange={(participantContactIds, participantNames) =>
            onChange({
              ...card,
              payload: { ...card.payload, participantContactIds, participantNames },
            })
          }
          participantNames={card.payload.participantNames}
        />
        <Field
          label="Notes"
          multiline
          onChangeText={(notes) => onChange({ ...card, payload: { ...card.payload, notes } })}
          value={card.payload.notes}
        />
      </View>
    );
  }

  if (card.type === "create_contact") {
    return (
      <View style={styles.fields}>
        <Field
          label="Name"
          onChangeText={(displayName) => onChange({ ...card, payload: { ...card.payload, displayName } })}
          value={card.payload.displayName}
        />
        <View style={styles.toggleRow}>
          <View>
            <Text style={styles.toggleTitle}>This is me</Text>
            <Text style={styles.toggleMeta}>Self contact</Text>
          </View>
          <Switch
            accessibilityLabel={`This contact is me: ${card.payload.displayName}`}
            onValueChange={(isSelf) =>
              onChange({ ...card, payload: { ...card.payload, isSelf } })
            }
            thumbColor="#FFFFFF"
            trackColor={{ false: colors.border, true: colors.primary }}
            value={card.payload.isSelf}
          />
        </View>
        <View style={styles.fieldRow}>
          <Field
            label="Company"
            onChangeText={(company) => onChange({ ...card, payload: { ...card.payload, company } })}
            value={card.payload.company}
          />
          <Field
            label="Role"
            onChangeText={(jobTitle) => onChange({ ...card, payload: { ...card.payload, jobTitle } })}
            value={card.payload.jobTitle}
          />
        </View>
        <View style={styles.fieldRow}>
          <Field
            label="Phone"
            onChangeText={(phone) =>
              onChange({ ...card, payload: { ...card.payload, phones: phone ? [phone] : [] } })
            }
            value={card.payload.phones[0] ?? ""}
          />
          <Field
            label="Email"
            onChangeText={(email) =>
              onChange({ ...card, payload: { ...card.payload, emails: email ? [email] : [] } })
            }
            value={card.payload.emails[0] ?? ""}
          />
        </View>
      </View>
    );
  }

  if (card.type === "update_meeting") {
    const timezoneChange = card.payload.changes.find((change) => change.field === "timezone");
    const timezone =
      (timezoneChange?.field === "timezone" ? timezoneChange.nextValue : null) ||
      Intl.DateTimeFormat().resolvedOptions().timeZone ||
      "UTC";
    const participantChangeIndex = card.payload.changes.findIndex(
      (change) => change.field === "participantContactIds",
    );
    const participantChange = card.payload.changes[participantChangeIndex];
    const existingMeeting = meetings.find(
      (meeting) =>
        meeting.id === card.payload.meetingId ||
        meeting.externalEventId === card.payload.meetingId,
    );
    const previousParticipantIds =
      participantChange?.field === "participantContactIds"
        ? participantChange.previousValue
        : existingMeeting?.participantContactIds ?? [];
    const proposedParticipantIds =
      participantChange?.field === "participantContactIds"
        ? participantChange.nextValue
        : previousParticipantIds;
    const showParticipantEditor =
      participantChange?.field === "participantContactIds" || card.payload.participantNames.length > 0;
    return (
      <View style={styles.fields}>
        <Field label="Meeting" onChangeText={() => undefined} readOnly value={card.payload.displayTitle} />
        {showParticipantEditor ? (
          <MeetingParticipantsField
            contactIds={proposedParticipantIds}
            contacts={contacts}
            onChange={(participantContactIds, participantNames) => {
              const changes =
                participantChangeIndex >= 0
                  ? card.payload.changes.map((change, index) =>
                      index === participantChangeIndex && change.field === "participantContactIds"
                        ? { ...change, nextValue: participantContactIds }
                        : change,
                    )
                  : [
                      ...card.payload.changes,
                      {
                        field: "participantContactIds" as const,
                        previousValue: previousParticipantIds,
                        nextValue: participantContactIds,
                      },
                    ];
              onChange({ ...card, payload: { ...card.payload, changes, participantNames } });
            }}
            participantNames={card.payload.participantNames}
          />
        ) : null}
        {card.payload.changes.map((change, index) => (
          change.field === "participantContactIds" ? null : <View key={`${change.field}-${index}`} style={styles.changeRow}>
            <View style={styles.changeLabel}>
              <Text style={styles.changeField}>{change.field}</Text>
              <Text numberOfLines={1} style={styles.previousValue}>
                {formatMeetingChangeValue(change.field, change.previousValue) || "No existing value"}
              </Text>
            </View>
            {change.field === "startAt" || change.field === "endAt" ? (
              <DateTimeField
                label="New date and time"
                onChange={(nextValue) => {
                  const changes = card.payload.changes.map((item, itemIndex) =>
                    itemIndex === index && (item.field === "startAt" || item.field === "endAt")
                      ? { ...item, nextValue: nextValue ?? null }
                      : item,
                  );
                  onChange({ ...card, payload: { ...card.payload, changes } });
                }}
                timezone={timezone}
                value={change.nextValue ?? undefined}
              />
            ) : (
              <Field
                label="New value"
                onChangeText={(nextValue) => {
                  const changes = card.payload.changes.map((item, itemIndex) => {
                    if (itemIndex !== index) return item;
                    if (item.field === "participantContactIds") return item;
                    if (item.field === "title" || item.field === "timezone") {
                      return { ...item, nextValue };
                    }
                    return { ...item, nextValue: nextValue || null };
                  });
                  onChange({ ...card, payload: { ...card.payload, changes } });
                }}
                value={formatMeetingChangeValue(change.field, change.nextValue)}
              />
            )}
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.fields}>
      <Field label="Contact" onChangeText={() => undefined} readOnly value={card.payload.displayName} />
      {card.payload.changes.map((change, index) => (
        <View key={`${change.field}-${index}`} style={styles.changeRow}>
          <View style={styles.changeLabel}>
            <Text style={styles.changeField}>{change.field}</Text>
            <Text numberOfLines={1} style={styles.previousValue}>
              {change.previousValue || "No existing value"}
            </Text>
          </View>
          <Field
            label="New value"
            onChangeText={(nextValue) => {
              const changes = card.payload.changes.map((item, itemIndex) =>
                itemIndex === index ? { ...item, nextValue } : item,
              );
              onChange({ ...card, payload: { ...card.payload, changes } });
            }}
            value={change.nextValue}
          />
        </View>
      ))}
    </View>
  );
}

const selfAliases = new Set(["me", "myself", "i", "user", "我", "我自己", "本人", "自己", "用户"]);

function normalizeParticipantName(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase().replace(/[\s._-]+/g, " ");
}

function splitParticipantNames(value: string): string[] {
  return value
    .split(/[,，]/)
    .map((name) => name.trim())
    .filter(Boolean);
}

type MeetingParticipantsFieldProps = {
  contactIds: string[];
  contacts: ContactRecord[];
  onChange: (contactIds: string[], participantNames: string[]) => void;
  participantNames: string[];
};

function MeetingParticipantsField({
  contactIds,
  contacts,
  onChange,
  participantNames,
}: MeetingParticipantsFieldProps) {
  const [open, setOpen] = useState(false);
  const uniqueContacts = [
    ...new Map(
      contacts
        .filter((contact) => contact.status === "active" && contact.displayName)
        .map((contact) => [contact.id, contact]),
    ).values(),
  ].sort((left, right) => left.displayName.localeCompare(right.displayName));
  const contactById = new Map<string, ContactRecord>();
  for (const contact of uniqueContacts) {
    contactById.set(contact.id, contact);
    if (contact.externalContactId) contactById.set(contact.externalContactId, contact);
  }
  const canonicalContactIds = contactIds.map((id) => contactById.get(id)?.id ?? id);
  const contactIdsByAlias = new Map<string, Set<string>>();
  for (const contact of uniqueContacts) {
    const aliases = [normalizeParticipantName(contact.displayName)];
    if (contact.isSelf) {
      aliases.push(...selfAliases);
    }
    for (const alias of aliases) {
      const ids = contactIdsByAlias.get(alias) ?? new Set<string>();
      ids.add(contact.id);
      contactIdsByAlias.set(alias, ids);
    }
  }
  const resolvedContactId = (name: string) => {
    const ids = contactIdsByAlias.get(normalizeParticipantName(name));
    return ids?.size === 1 ? [...ids][0] : undefined;
  };
  const inferredContactIds = participantNames.flatMap((name) => {
    const id = resolvedContactId(name);
    return id ? [id] : [];
  });
  const effectiveContactIds = [...new Set([...canonicalContactIds, ...inferredContactIds])];
  const selectedContacts = effectiveContactIds.map((id) => ({ contact: contactById.get(id), id }));
  const unmatchedNames = participantNames.filter((name) => !resolvedContactId(name));
  const participantLabels = [
    ...selectedContacts.map(({ contact }) => contact?.displayName || "Unknown contact"),
    ...unmatchedNames,
  ].filter(
    (name, index, values) =>
      values.findIndex(
        (candidate) => normalizeParticipantName(candidate) === normalizeParticipantName(name),
      ) === index,
  );
  const summary = participantLabels.join(", ") || "No participants selected";
  const participantCount = effectiveContactIds.length + unmatchedNames.length;
  const unknownIds = selectedContacts.filter(({ contact }) => !contact).map(({ id }) => id);

  function toggleContact(contactId: string) {
    const selected = effectiveContactIds.includes(contactId);
    onChange(
      selected
        ? effectiveContactIds.filter((id) => id !== contactId)
        : [...effectiveContactIds, contactId],
      selected
        ? participantNames.filter((name) => resolvedContactId(name) !== contactId)
        : participantNames,
    );
  }

  return (
    <View style={styles.participantField}>
      <Text style={styles.fieldLabel}>Participants</Text>
      <Pressable
        accessibilityLabel="Edit proposed meeting participants"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((current) => !current)}
        style={({ pressed }) => [styles.participantPickerHeader, pressed && styles.participantPressed]}
      >
        <View style={styles.participantSummaryCopy}>
          <Text
            accessibilityLabel={`Proposed meeting participants: ${summary}`}
            numberOfLines={2}
            style={styles.participantSummary}
          >
            {summary}
          </Text>
          <Text style={styles.participantCount}>
            {participantCount} {participantCount === 1 ? "person" : "people"}
          </Text>
        </View>
        <ChevronDown
          color={colors.blue}
          size={19}
          strokeWidth={2.1}
          style={open ? styles.participantChevronOpen : undefined}
        />
      </Pressable>

      {open ? (
        <View style={styles.participantPicker}>
          <ScrollView nestedScrollEnabled style={styles.participantPickerList}>
            {uniqueContacts.map((contact) => {
              const selected = effectiveContactIds.includes(contact.id);
              return (
                <Pressable
                  accessibilityLabel={`${selected ? "Remove" : "Add"} ${contact.displayName} ${selected ? "from" : "to"} proposed meeting`}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  aria-checked={selected}
                  key={contact.id}
                  onPress={() => toggleContact(contact.id)}
                  style={({ pressed }) => [styles.participantOption, pressed && styles.participantPressed]}
                >
                  <View style={styles.participantOptionCopy}>
                    <Text numberOfLines={1} style={styles.participantOptionName}>
                      {contact.displayName}
                    </Text>
                    <Text numberOfLines={1} style={styles.participantOptionMeta}>
                      {contact.isSelf
                        ? "You"
                        : [contact.company, contact.jobTitle].filter(Boolean).join(" · ") || "Contact"}
                    </Text>
                  </View>
                  <View style={[styles.participantCheckbox, selected && styles.participantCheckboxSelected]}>
                    {selected ? <Check color="#FFFFFF" size={14} strokeWidth={2.5} /> : null}
                  </View>
                </Pressable>
              );
            })}
            {unknownIds.map((contactId) => (
              <Pressable
                accessibilityLabel="Remove unknown contact from proposed meeting"
                accessibilityRole="checkbox"
                accessibilityState={{ checked: true }}
                aria-checked
                key={contactId}
                onPress={() => toggleContact(contactId)}
                style={({ pressed }) => [styles.participantOption, pressed && styles.participantPressed]}
              >
                <View style={styles.participantOptionCopy}>
                  <Text style={styles.participantOptionName}>Unknown contact</Text>
                  <Text numberOfLines={1} style={styles.participantOptionMeta}>{contactId}</Text>
                </View>
                <View style={[styles.participantCheckbox, styles.participantCheckboxSelected]}>
                  <Check color="#FFFFFF" size={14} strokeWidth={2.5} />
                </View>
              </Pressable>
            ))}
            {uniqueContacts.length === 0 && unknownIds.length === 0 ? (
              <Text style={styles.participantPickerEmpty}>No saved contacts.</Text>
            ) : null}
          </ScrollView>
        </View>
      ) : null}

      {unmatchedNames.length > 0 ? (
        <Field
          label="Names not matched to contacts"
          onChangeText={(value) => onChange(effectiveContactIds, splitParticipantNames(value))}
          value={unmatchedNames.join(", ")}
        />
      ) : null}
    </View>
  );
}

function formatMeetingChangeValue(field: string, value: string | string[] | null): string {
  if (Array.isArray(value)) return value.join(", ");
  if ((field === "startAt" || field === "endAt") && value) {
    const date = new Date(value);
    if (Number.isFinite(date.getTime())) {
      return date.toLocaleString(undefined, {
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        month: "short",
        year: "numeric",
      });
    }
  }
  return value ?? "";
}

type FieldProps = {
  label: string;
  multiline?: boolean;
  onChangeText: (value: string) => void;
  readOnly?: boolean;
  value: string;
};

function Field({ label, multiline, onChangeText, readOnly, value }: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        editable={!readOnly}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.primary}
        style={[styles.input, multiline && styles.inputMultiline, readOnly && styles.inputReadOnly]}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 16,
    padding: 18,
    shadowColor: colors.shadow,
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
  },
  cardUnselected: {
    backgroundColor: colors.surfaceMuted,
    opacity: 0.78,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  checkbox: {
    alignItems: "center",
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  iconBox: {
    alignItems: "center",
    backgroundColor: colors.blueSoft,
    borderRadius: 6,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  kind: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    marginTop: 2,
  },
  confidence: {
    backgroundColor: colors.primarySoft,
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  confidenceCaution: {
    backgroundColor: colors.orangeSoft,
  },
  confidenceText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "700",
  },
  confidenceTextCaution: {
    color: colors.orange,
  },
  fields: {
    gap: 12,
  },
  fieldRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  toggleRow: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 54,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  toggleTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  toggleMeta: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  field: {
    flex: 1,
    gap: 6,
    minWidth: 180,
  },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "600",
  },
  participantField: {
    gap: 7,
  },
  participantPickerHeader: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 54,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  participantSummaryCopy: {
    flex: 1,
    minWidth: 0,
  },
  participantSummary: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 19,
  },
  participantCount: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  participantChevronOpen: {
    transform: [{ rotate: "180deg" }],
  },
  participantPicker: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 6,
    borderWidth: 1,
    overflow: "hidden",
  },
  participantPickerList: {
    maxHeight: 230,
  },
  participantOption: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  participantOptionCopy: {
    flex: 1,
    minWidth: 0,
  },
  participantOptionName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  participantOptionMeta: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  participantCheckbox: {
    alignItems: "center",
    borderColor: colors.textMuted,
    borderRadius: 4,
    borderWidth: 1,
    height: 22,
    justifyContent: "center",
    width: 22,
  },
  participantCheckboxSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  participantPickerEmpty: {
    color: colors.textMuted,
    fontSize: 13,
    padding: 12,
  },
  participantPressed: {
    opacity: 0.72,
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 6,
    borderWidth: 1,
    color: colors.text,
    fontSize: 14,
    minHeight: 42,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  inputMultiline: {
    minHeight: 68,
    textAlignVertical: "top",
  },
  inputReadOnly: {
    backgroundColor: colors.surfaceMuted,
  },
  changeRow: {
    alignItems: "flex-end",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  changeLabel: {
    minWidth: 150,
    paddingBottom: 8,
  },
  changeField: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  previousValue: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 3,
  },
  risks: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  riskText: {
    backgroundColor: colors.orangeSoft,
    borderRadius: 10,
    color: colors.orange,
    fontSize: 11,
    fontWeight: "600",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  evidence: {
    borderLeftColor: colors.blue,
    borderLeftWidth: 2,
    gap: 5,
    paddingLeft: 12,
  },
  evidenceLabel: {
    color: colors.blue,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  quote: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
});
