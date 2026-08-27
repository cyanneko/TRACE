import type {
  ActionCard,
  ContactChange,
  ContactRecord,
  Evidence,
  MeetingChange,
  MeetingRecord,
  UpdateContactCard,
  UpdateMeetingCard,
} from "@trace/contracts";
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
    return <UpdateMeetingFields card={card} contacts={contacts} meetings={meetings} onChange={onChange} />;
  }

  return <UpdateContactFields card={card} contacts={contacts} onChange={onChange} />;
}

type ContactTextField = "displayName" | "givenName" | "familyName" | "company" | "jobTitle";
type MeetingTextField = "title" | "timezone" | "location" | "meetingLink";

function sameValues(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function splitValues(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/[\n,，;；]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

function withContactChange(
  card: UpdateContactCard,
  change: ContactChange,
  unchanged: boolean,
): UpdateContactCard {
  const changes = card.payload.changes.filter((item) => item.field !== change.field);
  if (!unchanged) changes.push(change);
  return { ...card, payload: { ...card.payload, changes } };
}

function withMeetingChange(
  card: UpdateMeetingCard,
  change: MeetingChange,
  unchanged: boolean,
): UpdateMeetingCard {
  const changes = card.payload.changes.filter((item) => item.field !== change.field);
  if (!unchanged) changes.push(change);
  return { ...card, payload: { ...card.payload, changes } };
}

function UpdateContactFields({
  card,
  contacts,
  onChange,
}: {
  card: UpdateContactCard;
  contacts: ContactRecord[];
  onChange: Props["onChange"];
}) {
  const existing = contacts.find(
    (contact) => contact.id === card.payload.contactId || contact.externalContactId === card.payload.contactId,
  );
  const findChange = (field: ContactChange["field"]) =>
    card.payload.changes.find((change) => change.field === field);

  const displayNameChange = findChange("displayName");
  const givenNameChange = findChange("givenName");
  const familyNameChange = findChange("familyName");
  const companyChange = findChange("company");
  const jobTitleChange = findChange("jobTitle");
  const phonesChange = findChange("phones");
  const emailsChange = findChange("emails");
  const isSelfChange = findChange("isSelf");

  const previousDisplayName = existing?.displayName ??
    (displayNameChange?.field === "displayName" ? displayNameChange.previousValue : null) ??
    card.payload.displayName;
  const previousGivenName = existing?.givenName ??
    (givenNameChange?.field === "givenName" ? givenNameChange.previousValue : null) ?? "";
  const previousFamilyName = existing?.familyName ??
    (familyNameChange?.field === "familyName" ? familyNameChange.previousValue : null) ?? "";
  const previousCompany = existing?.company ??
    (companyChange?.field === "company" ? companyChange.previousValue : null) ?? "";
  const previousJobTitle = existing?.jobTitle ??
    (jobTitleChange?.field === "jobTitle" ? jobTitleChange.previousValue : null) ?? "";
  const previousPhones = existing?.phones ??
    (phonesChange?.field === "phones" ? phonesChange.previousValue : []);
  const previousEmails = existing?.emails ??
    (emailsChange?.field === "emails" ? emailsChange.previousValue : []);
  const previousIsSelf = existing?.isSelf ??
    (isSelfChange?.field === "isSelf" ? isSelfChange.previousValue : false);

  const displayName = displayNameChange?.field === "displayName"
    ? displayNameChange.nextValue ?? ""
    : previousDisplayName;
  const givenName = givenNameChange?.field === "givenName" ? givenNameChange.nextValue ?? "" : previousGivenName;
  const familyName = familyNameChange?.field === "familyName"
    ? familyNameChange.nextValue ?? ""
    : previousFamilyName;
  const company = companyChange?.field === "company" ? companyChange.nextValue ?? "" : previousCompany;
  const jobTitle = jobTitleChange?.field === "jobTitle" ? jobTitleChange.nextValue ?? "" : previousJobTitle;
  const phones = phonesChange?.field === "phones" ? phonesChange.nextValue : previousPhones;
  const emails = emailsChange?.field === "emails" ? emailsChange.nextValue : previousEmails;
  const isSelf = isSelfChange?.field === "isSelf" ? isSelfChange.nextValue : previousIsSelf;

  const updateText = (field: ContactTextField, previousValue: string, nextValue: string) => {
    const change: ContactChange = {
      field,
      previousValue: previousValue || null,
      nextValue: field === "displayName" ? nextValue : nextValue || null,
    };
    onChange(withContactChange(card, change, nextValue === previousValue));
  };

  return (
    <View style={styles.fields}>
      <View style={styles.editorStatus}>
        <Text numberOfLines={1} style={styles.editorTarget}>Editing {card.payload.displayName}</Text>
        <Text style={styles.editorChangeCount}>{card.payload.changes.length} changed</Text>
      </View>
      <Field label="Name" onChangeText={(value) => updateText("displayName", previousDisplayName, value)} value={displayName} />
      <View style={styles.fieldRow}>
        <Field label="Given name" onChangeText={(value) => updateText("givenName", previousGivenName, value)} value={givenName} />
        <Field label="Family name" onChangeText={(value) => updateText("familyName", previousFamilyName, value)} value={familyName} />
      </View>
      <View style={styles.fieldRow}>
        <Field label="Company" onChangeText={(value) => updateText("company", previousCompany, value)} value={company} />
        <Field label="Role" onChangeText={(value) => updateText("jobTitle", previousJobTitle, value)} value={jobTitle} />
      </View>
      <View style={styles.fieldRow}>
        <Field
          label="Phone numbers"
          multiline
          onChangeText={(value) => {
            const nextValue = splitValues(value);
            onChange(withContactChange(card, {
              field: "phones",
              previousValue: previousPhones,
              nextValue,
            }, sameValues(previousPhones, nextValue)));
          }}
          value={phones.join("\n")}
        />
        <Field
          label="Email addresses"
          multiline
          onChangeText={(value) => {
            const nextValue = splitValues(value);
            onChange(withContactChange(card, {
              field: "emails",
              previousValue: previousEmails,
              nextValue,
            }, sameValues(previousEmails, nextValue)));
          }}
          value={emails.join("\n")}
        />
      </View>
      <View style={styles.toggleRow}>
        <View>
          <Text style={styles.toggleTitle}>This is me</Text>
          <Text style={styles.toggleMeta}>Self contact</Text>
        </View>
        <Switch
          accessibilityLabel={`This contact is me: ${card.payload.displayName}`}
          onValueChange={(nextValue) =>
            onChange(withContactChange(card, {
              field: "isSelf",
              previousValue: previousIsSelf,
              nextValue,
            }, nextValue === previousIsSelf))
          }
          thumbColor="#FFFFFF"
          trackColor={{ false: colors.border, true: colors.primary }}
          value={isSelf}
        />
      </View>
    </View>
  );
}

function UpdateMeetingFields({
  card,
  contacts,
  meetings,
  onChange,
}: {
  card: UpdateMeetingCard;
  contacts: ContactRecord[];
  meetings: MeetingRecord[];
  onChange: Props["onChange"];
}) {
  const existing = meetings.find(
    (meeting) => meeting.id === card.payload.meetingId || meeting.externalEventId === card.payload.meetingId,
  );
  const findChange = (field: MeetingChange["field"]) =>
    card.payload.changes.find((change) => change.field === field);

  const titleChange = findChange("title");
  const startChange = findChange("startAt");
  const endChange = findChange("endAt");
  const timezoneChange = findChange("timezone");
  const allDayChange = findChange("allDay");
  const locationChange = findChange("location");
  const meetingLinkChange = findChange("meetingLink");
  const participantsChange = findChange("participantContactIds");

  const previousTitle = existing?.title ??
    (titleChange?.field === "title" ? titleChange.previousValue : null) ?? card.payload.displayTitle;
  const previousStartAt = existing?.startAt ??
    (startChange?.field === "startAt" ? startChange.previousValue : null);
  const previousEndAt = existing?.endAt ??
    (endChange?.field === "endAt" ? endChange.previousValue : null);
  const previousTimezone = (
    existing?.timezone ??
    (timezoneChange?.field === "timezone" ? timezoneChange.previousValue : null) ??
    Intl.DateTimeFormat().resolvedOptions().timeZone
  ) || "UTC";
  const previousAllDay = existing?.allDay ??
    (allDayChange?.field === "allDay" ? allDayChange.previousValue : false);
  const previousLocation = existing?.location ??
    (locationChange?.field === "location" ? locationChange.previousValue : null) ?? "";
  const previousMeetingLink = existing?.meetingLink ??
    (meetingLinkChange?.field === "meetingLink" ? meetingLinkChange.previousValue : null) ?? "";
  const previousParticipantIds = existing?.participantContactIds ??
    (participantsChange?.field === "participantContactIds" ? participantsChange.previousValue : []);

  const title = titleChange?.field === "title" ? titleChange.nextValue ?? "" : previousTitle;
  const startAt = startChange?.field === "startAt" ? startChange.nextValue : previousStartAt;
  const endAt = endChange?.field === "endAt" ? endChange.nextValue : previousEndAt;
  const timezone = timezoneChange?.field === "timezone" ? timezoneChange.nextValue ?? "" : previousTimezone;
  const allDay = allDayChange?.field === "allDay" ? allDayChange.nextValue : previousAllDay;
  const location = locationChange?.field === "location" ? locationChange.nextValue ?? "" : previousLocation;
  const meetingLink = meetingLinkChange?.field === "meetingLink"
    ? meetingLinkChange.nextValue ?? ""
    : previousMeetingLink;
  const participantContactIds = participantsChange?.field === "participantContactIds"
    ? participantsChange.nextValue
    : previousParticipantIds;

  const updateText = (field: MeetingTextField, previousValue: string, nextValue: string) => {
    const change: MeetingChange = {
      field,
      previousValue: previousValue || null,
      nextValue: field === "title" || field === "timezone" ? nextValue : nextValue || null,
    };
    onChange(withMeetingChange(card, change, nextValue === previousValue));
  };
  const updateTime = (field: "startAt" | "endAt", previousValue: string | null, nextValue?: string) =>
    withMeetingChange(card, {
      field,
      previousValue,
      nextValue: nextValue ?? null,
    }, (nextValue ?? null) === previousValue);

  const updateStartAt = (nextStartAt?: string) => {
    let nextCard = updateTime("startAt", previousStartAt ?? null, nextStartAt);
    if (nextStartAt && startAt && endAt) {
      const currentStart = new Date(startAt);
      const currentEnd = new Date(endAt);
      const duration = currentEnd.getTime() - currentStart.getTime();
      if (Number.isFinite(duration) && duration >= 0) {
        const nextEndAt = new Date(new Date(nextStartAt).getTime() + duration).toISOString();
        nextCard = withMeetingChange(nextCard, {
          field: "endAt",
          previousValue: previousEndAt ?? null,
          nextValue: nextEndAt,
        }, nextEndAt === (previousEndAt ?? null));
      }
    }
    onChange(nextCard);
  };

  return (
    <View style={styles.fields}>
      <View style={styles.editorStatus}>
        <Text numberOfLines={1} style={styles.editorTarget}>Editing {card.payload.displayTitle}</Text>
        <Text style={styles.editorChangeCount}>{card.payload.changes.length} changed</Text>
      </View>
      <Field label="Title" onChangeText={(value) => updateText("title", previousTitle, value)} value={title} />
      <View style={styles.fieldRow}>
        <DateTimeField label="Starts" onChange={updateStartAt} timezone={timezone || previousTimezone} value={startAt ?? undefined} />
        <DateTimeField
          label="Ends"
          onChange={(value) => onChange(updateTime("endAt", previousEndAt ?? null, value))}
          timezone={timezone || previousTimezone}
          value={endAt ?? undefined}
        />
      </View>
      <View style={styles.toggleRow}>
        <View>
          <Text style={styles.toggleTitle}>All day</Text>
          <Text style={styles.toggleMeta}>Calendar event</Text>
        </View>
        <Switch
          accessibilityLabel={`All-day meeting: ${card.payload.displayTitle}`}
          onValueChange={(nextValue) =>
            onChange(withMeetingChange(card, {
              field: "allDay",
              previousValue: previousAllDay,
              nextValue,
            }, nextValue === previousAllDay))
          }
          thumbColor="#FFFFFF"
          trackColor={{ false: colors.border, true: colors.primary }}
          value={allDay}
        />
      </View>
      <View style={styles.fieldRow}>
        <Field label="Timezone" onChangeText={(value) => updateText("timezone", previousTimezone, value)} value={timezone} />
        <Field label="Location" onChangeText={(value) => updateText("location", previousLocation, value)} value={location} />
      </View>
      <Field
        label="Meeting link"
        onChangeText={(value) => updateText("meetingLink", previousMeetingLink, value)}
        value={meetingLink}
      />
      <MeetingParticipantsField
        contactIds={participantContactIds}
        contacts={contacts}
        onChange={(nextContactIds, participantNames) => {
          const nextCard = withMeetingChange(card, {
            field: "participantContactIds",
            previousValue: previousParticipantIds,
            nextValue: nextContactIds,
          }, sameValues(previousParticipantIds, nextContactIds));
          onChange({ ...nextCard, payload: { ...nextCard.payload, participantNames } });
        }}
        participantNames={card.payload.participantNames}
      />
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
  editorStatus: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  editorTarget: {
    color: colors.text,
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    minWidth: 0,
  },
  editorChangeCount: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "700",
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
