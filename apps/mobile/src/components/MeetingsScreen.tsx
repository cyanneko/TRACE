import type { ContactRecord, EntityMemory, MeetingRecord, MeetingState } from "@trace/contracts";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronRight,
  Plus,
  Save,
  SquarePen,
  Trash2,
  UserMinus,
  UserPlus,
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { meetingState, sortContacts, sortMeetings } from "../entities/presentation";
import { colors } from "../theme";
import { DateTimeField } from "./DateTimeField";
import { EntityMemoryEditor } from "./EntityMemoryEditor";

type Props = {
  contacts: ContactRecord[];
  error: string | null;
  loading: boolean;
  meetings: MeetingRecord[];
  memories: EntityMemory[];
  onAddMemory: (meetingId: string, content: string) => Promise<void>;
  onAddParticipant: (meetingId: string, contactId: string) => Promise<void>;
  onCreate: () => Promise<void>;
  onCreateParticipant: (meetingId: string) => Promise<void>;
  onDelete: (meetingId: string) => Promise<void>;
  onDeleteMemory: (memoryId: string) => Promise<void>;
  onOpenContact: (contactId: string) => void;
  onRemoveParticipant: (meetingId: string, contactId: string) => Promise<void>;
  onSave: (meeting: MeetingRecord) => Promise<void>;
  onSelect: (meetingId: string | null) => void;
  onUpdateMemory: (memoryId: string, content: string) => Promise<void>;
  selectedMeetingId: string | null;
};

export function MeetingsScreen({
  contacts,
  error,
  loading,
  meetings,
  memories,
  onAddMemory,
  onAddParticipant,
  onCreate,
  onCreateParticipant,
  onDelete,
  onDeleteMemory,
  onOpenContact,
  onRemoveParticipant,
  onSave,
  onSelect,
  onUpdateMemory,
  selectedMeetingId,
}: Props) {
  const selected = meetings.find((meeting) => meeting.id === selectedMeetingId);
  if (selected) {
    return (
      <MeetingDetail
        contacts={contacts}
        error={error}
        meeting={selected}
        memories={memories.filter(
          (memory) => memory.ownerType === "meeting" && memory.ownerId === selected.id,
        )}
        onAddMemory={(content) => onAddMemory(selected.id, content)}
        onAddParticipant={(contactId) => onAddParticipant(selected.id, contactId)}
        onBack={() => onSelect(null)}
        onCreateParticipant={() => onCreateParticipant(selected.id)}
        onDelete={async () => {
          await onDelete(selected.id);
          onSelect(null);
        }}
        onDeleteMemory={onDeleteMemory}
        onOpenContact={onOpenContact}
        onRemoveParticipant={(contactId) => onRemoveParticipant(selected.id, contactId)}
        onSave={onSave}
        onUpdateMemory={onUpdateMemory}
      />
    );
  }

  return (
    <MeetingList
      error={error}
      loading={loading}
      meetings={meetings}
      memories={memories}
      onCreate={onCreate}
      onSelect={(meetingId) => onSelect(meetingId)}
    />
  );
}

function MeetingList({
  error,
  loading,
  meetings,
  memories,
  onCreate,
  onSelect,
}: Pick<Props, "error" | "loading" | "meetings" | "memories" | "onCreate"> & {
  onSelect: (meetingId: string) => void;
}) {
  const now = new Date();
  const sorted = sortMeetings(meetings, now);
  const memoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const memory of memories) {
      if (memory.ownerType === "meeting" && memory.status === "active") {
        counts.set(memory.ownerId, (counts.get(memory.ownerId) ?? 0) + 1);
      }
    }
    return counts;
  }, [memories]);

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.content}>
        <View style={styles.pageHeading}>
          <View>
            <Text style={styles.eyebrow}>MEETINGS</Text>
            <Text style={styles.pageTitle}>Timeline</Text>
          </View>
          <Pressable
            accessibilityLabel="Create meeting"
            onPress={() => void onCreate()}
            style={({ pressed }) => [styles.createButton, pressed && styles.pressed]}
          >
            <Plus color="#FFFFFF" size={21} strokeWidth={2.2} />
          </Pressable>
        </View>

        {loading ? <ActivityIndicator color={colors.primary} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!loading && sorted.length === 0 ? <Text style={styles.empty}>No meetings.</Text> : null}

        <View style={styles.rows}>
          {sorted.map((meeting) => {
            const state = meetingState(meeting, now);
            return (
              <Pressable
                accessibilityLabel={`Open ${meeting.title || "unnamed meeting"}`}
                key={meeting.id}
                onPress={() => onSelect(meeting.id)}
                style={({ pressed }) => [
                  styles.row,
                  state === "ongoing" && styles.rowOngoing,
                  state === "ended" && styles.rowEnded,
                  pressed && styles.rowPressed,
                ]}
              >
                <View style={[styles.calendarIcon, state === "ongoing" && styles.calendarIconOngoing]}>
                  <CalendarDays
                    color={state === "ongoing" ? colors.primary : colors.blue}
                    size={20}
                    strokeWidth={2}
                  />
                </View>
                <View style={styles.rowCopy}>
                  <View style={styles.titleLine}>
                    <Text numberOfLines={1} style={styles.rowTitle}>
                      {meeting.title || "Unnamed meeting"}
                    </Text>
                    <MeetingStateLabel state={state} />
                  </View>
                  <Text numberOfLines={1} style={styles.rowMeta}>
                    {meetingTimeLabel(meeting)} · {meeting.participantContactIds.length} people · {memoryCounts.get(meeting.id) ?? 0} memories
                  </Text>
                </View>
                <ChevronRight color={colors.textMuted} size={19} strokeWidth={2} />
              </Pressable>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

function MeetingStateLabel({ state }: { state: MeetingState }) {
  const label = {
    ended: "Ended",
    ongoing: "In progress",
    time_unresolved: "Time pending",
    upcoming: "Upcoming",
  }[state];
  return <Text style={[styles.state, styles[`state_${state}`]]}>{label}</Text>;
}

function meetingTimeLabel(meeting: MeetingRecord): string {
  if (!meeting.startAt) return "Time pending";
  const start = new Date(meeting.startAt);
  const end = meeting.endAt ? new Date(meeting.endAt) : null;
  if (!Number.isFinite(start.getTime())) return "Time pending";
  const date = start.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  const startTime = start.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  const endTime = end?.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return `${date}, ${startTime}${endTime ? ` - ${endTime}` : ""}`;
}

type MeetingDetailProps = {
  contacts: ContactRecord[];
  error: string | null;
  meeting: MeetingRecord;
  memories: EntityMemory[];
  onAddMemory: (content: string) => Promise<void>;
  onAddParticipant: (contactId: string) => Promise<void>;
  onBack: () => void;
  onCreateParticipant: () => Promise<void>;
  onDelete: () => Promise<void>;
  onDeleteMemory: (memoryId: string) => Promise<void>;
  onOpenContact: (contactId: string) => void;
  onRemoveParticipant: (contactId: string) => Promise<void>;
  onSave: (meeting: MeetingRecord) => Promise<void>;
  onUpdateMemory: (memoryId: string, content: string) => Promise<void>;
};

function MeetingDetail({
  contacts,
  error,
  meeting,
  memories,
  onAddMemory,
  onAddParticipant,
  onBack,
  onCreateParticipant,
  onDelete,
  onDeleteMemory,
  onOpenContact,
  onRemoveParticipant,
  onSave,
  onUpdateMemory,
}: MeetingDetailProps) {
  const [draft, setDraft] = useState(meeting);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const contactById = useMemo(() => {
    const indexed = new Map<string, ContactRecord>();
    for (const contact of contacts) {
      indexed.set(contact.id, contact);
      if (contact.externalContactId) indexed.set(contact.externalContactId, contact);
    }
    return indexed;
  }, [contacts]);
  const sortedContacts = sortContacts(contacts);

  useEffect(() => setDraft(meeting), [meeting.id]);

  async function save() {
    setSaving(true);
    try {
      await onSave({
        ...draft,
        startAt: draft.startAt || undefined,
        endAt: draft.endAt || undefined,
        status: draft.title.trim() ? "active" : "draft",
        updatedAt: new Date().toISOString(),
      });
    } finally {
      setSaving(false);
    }
  }

  function updateStartAt(startAt: string | undefined) {
    setDraft((current) => {
      if (!startAt) return { ...current, startAt: undefined };
      const nextStart = new Date(startAt);
      const previousStart = current.startAt ? new Date(current.startAt) : null;
      const previousEnd = current.endAt ? new Date(current.endAt) : null;
      const duration =
        previousStart && previousEnd
          ? Math.max(0, previousEnd.getTime() - previousStart.getTime())
          : 30 * 60 * 1_000;
      return {
        ...current,
        startAt,
        endAt: new Date(nextStart.getTime() + duration).toISOString(),
      };
    });
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <View style={styles.content}>
        <View style={styles.detailHeading}>
          <Pressable accessibilityLabel="Back to meetings" hitSlop={6} onPress={onBack} style={styles.backButton}>
            <ArrowLeft color={colors.text} size={21} strokeWidth={2} />
          </Pressable>
          <View style={styles.detailHeadingCopy}>
            <Text style={styles.eyebrow}>MEETING</Text>
            <Text numberOfLines={1} style={styles.pageTitle}>
              {meeting.title || "Unnamed meeting"}
            </Text>
          </View>
          <Pressable
            accessibilityLabel="Save meeting"
            disabled={saving}
            onPress={() => void save()}
            style={[styles.saveButton, saving && styles.disabled]}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Save color="#FFFFFF" size={19} strokeWidth={2.1} />
            )}
          </Pressable>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic information</Text>
          <DetailField
            label="Title"
            onChangeText={(title) => setDraft((current) => ({ ...current, title }))}
            value={draft.title}
          />
          <View style={styles.fieldRow}>
            <DateTimeField
              label="Starts"
              onChange={updateStartAt}
              timezone={draft.timezone}
              value={draft.startAt}
            />
            <DateTimeField
              label="Ends"
              onChange={(endAt) => setDraft((current) => ({ ...current, endAt }))}
              timezone={draft.timezone}
              value={draft.endAt}
            />
          </View>
          <View style={styles.fieldRow}>
            <DetailField
              label="Timezone"
              onChangeText={(timezone) => setDraft((current) => ({ ...current, timezone }))}
              value={draft.timezone}
            />
            <DetailField
              label="Location"
              onChangeText={(location) => setDraft((current) => ({ ...current, location }))}
              value={draft.location ?? ""}
            />
          </View>
          <DetailField
            label="Meeting link"
            onChangeText={(meetingLink) => setDraft((current) => ({ ...current, meetingLink }))}
            value={draft.meetingLink ?? ""}
          />
        </View>

        <View style={styles.section}>
          <Pressable
            accessibilityLabel="Edit participants"
            accessibilityState={{ expanded: pickerOpen }}
            onPress={() => setPickerOpen((value) => !value)}
            style={({ pressed }) => [styles.sectionHeading, pressed && styles.pressed]}
          >
            <View>
              <Text style={styles.sectionTitle}>Participants</Text>
              <Text style={styles.sectionMeta}>{meeting.participantContactIds.length} people</Text>
            </View>
            <View style={styles.secondaryIconButton}>
              {pickerOpen ? (
                <Check color={colors.primary} size={20} strokeWidth={2.2} />
              ) : (
                <SquarePen color={colors.blue} size={19} strokeWidth={2.1} />
              )}
            </View>
          </Pressable>

          {pickerOpen ? (
            <View style={styles.picker}>
              <Pressable
                onPress={() => void onCreateParticipant()}
                style={({ pressed }) => [styles.pickerRow, pressed && styles.rowPressed]}
              >
                <Plus color={colors.primary} size={18} strokeWidth={2.2} />
                <Text style={styles.pickerText}>New contact</Text>
              </Pressable>
              <ScrollView nestedScrollEnabled style={styles.pickerContacts}>
                {sortedContacts.map((contact) => {
                  const participantId = meeting.participantContactIds.find(
                    (id) => id === contact.id || id === contact.externalContactId,
                  );
                  const selected = Boolean(participantId);
                  return (
                    <Pressable
                      accessibilityLabel={`${selected ? "Remove" : "Add"} ${contact.displayName || "unnamed contact"} ${selected ? "from" : "to"} meeting`}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected }}
                      key={contact.id}
                      onPress={() =>
                        void (selected && participantId
                          ? onRemoveParticipant(participantId)
                          : onAddParticipant(contact.id))
                      }
                      style={({ pressed }) => [styles.pickerRow, pressed && styles.rowPressed]}
                    >
                      <Text numberOfLines={1} style={styles.pickerText}>
                        {contact.displayName || "Unnamed contact"}
                      </Text>
                      <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                        {selected ? <Check color="#FFFFFF" size={15} strokeWidth={2.4} /> : null}
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}

          <View style={styles.participants}>
            {meeting.participantContactIds.map((contactId) => {
              const contact = contactById.get(contactId);
              return (
                <View key={contactId} style={styles.participantRow}>
                  <Pressable
                    accessibilityLabel={`Open ${contact?.displayName || "contact"}`}
                    onPress={() => onOpenContact(contactId)}
                    style={({ pressed }) => [styles.participantMain, pressed && styles.rowPressed]}
                  >
                    <View style={styles.personIcon}>
                      <UserPlus color={colors.blue} size={18} strokeWidth={2} />
                    </View>
                    <View style={styles.participantCopy}>
                      <Text numberOfLines={1} style={styles.participantName}>
                        {contact?.displayName || "Unknown contact"}
                      </Text>
                      <Text numberOfLines={1} style={styles.participantMeta}>
                        {[contact?.company, contact?.jobTitle].filter(Boolean).join(" · ") || "Contact"}
                      </Text>
                    </View>
                    <ChevronRight color={colors.textMuted} size={18} strokeWidth={2} />
                  </Pressable>
                  <Pressable
                    accessibilityLabel={`Remove ${contact?.displayName || "participant"}`}
                    onPress={() => void onRemoveParticipant(contactId)}
                    style={({ pressed }) => [styles.removeButton, pressed && styles.pressed]}
                  >
                    <UserMinus color={colors.danger} size={18} strokeWidth={2} />
                  </Pressable>
                </View>
              );
            })}
            {meeting.participantContactIds.length === 0 ? <Text style={styles.emptyInline}>No participants.</Text> : null}
          </View>
        </View>

        <EntityMemoryEditor
          memories={memories}
          onAdd={onAddMemory}
          onDelete={onDeleteMemory}
          onUpdate={onUpdateMemory}
        />

        <Pressable
          accessibilityLabel="Delete meeting"
          onPress={() => void onDelete()}
          style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}
        >
          <Trash2 color={colors.danger} size={18} strokeWidth={2} />
          <Text style={styles.deleteText}>Delete meeting</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

type DetailFieldProps = {
  label: string;
  onChangeText: (value: string) => void;
  value: string;
};

function DetailField({ label, onChangeText, value }: DetailFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        onChangeText={onChangeText}
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.primary}
        style={styles.input}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    paddingBottom: 32,
  },
  content: {
    alignSelf: "center",
    gap: 22,
    maxWidth: 860,
    paddingHorizontal: 20,
    paddingTop: 26,
    width: "100%",
  },
  pageHeading: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  detailHeading: {
    alignItems: "center",
    flexDirection: "row",
    gap: 11,
  },
  detailHeadingCopy: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "800",
  },
  pageTitle: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800",
    marginTop: 2,
  },
  createButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 7,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  saveButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 7,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  backButton: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 6,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  rows: {
    gap: 8,
  },
  row: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 7,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 76,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  rowOngoing: {
    borderColor: colors.primary,
    borderLeftWidth: 4,
  },
  rowEnded: {
    opacity: 0.56,
  },
  rowPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  calendarIcon: {
    alignItems: "center",
    backgroundColor: colors.blueSoft,
    borderRadius: 6,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  calendarIconOngoing: {
    backgroundColor: colors.primarySoft,
  },
  rowCopy: {
    flex: 1,
    gap: 5,
    minWidth: 0,
  },
  titleLine: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  rowTitle: {
    color: colors.text,
    flexShrink: 1,
    fontSize: 17,
    fontWeight: "700",
  },
  rowMeta: {
    color: colors.textMuted,
    fontSize: 13,
  },
  state: {
    borderRadius: 4,
    fontSize: 10,
    fontWeight: "800",
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  state_ongoing: {
    backgroundColor: colors.primarySoft,
    color: colors.primary,
  },
  state_upcoming: {
    backgroundColor: colors.blueSoft,
    color: colors.blue,
  },
  state_ended: {
    backgroundColor: colors.surfaceMuted,
    color: colors.textMuted,
  },
  state_time_unresolved: {
    backgroundColor: colors.orangeSoft,
    color: colors.orange,
  },
  section: {
    gap: 13,
  },
  sectionHeading: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
  },
  sectionMeta: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 3,
  },
  secondaryIconButton: {
    alignItems: "center",
    backgroundColor: colors.blueSoft,
    borderRadius: 6,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  fieldRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  field: {
    flex: 1,
    gap: 6,
    minWidth: 220,
  },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 6,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    minHeight: 45,
    paddingHorizontal: 11,
    paddingVertical: 10,
  },
  picker: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 6,
    borderWidth: 1,
    overflow: "hidden",
  },
  pickerContacts: {
    maxHeight: 280,
  },
  pickerRow: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 46,
    paddingHorizontal: 12,
  },
  pickerText: {
    color: colors.text,
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
  },
  checkbox: {
    alignItems: "center",
    borderColor: colors.textMuted,
    borderRadius: 4,
    borderWidth: 1,
    height: 22,
    justifyContent: "center",
    width: 22,
  },
  checkboxSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  participants: {
    gap: 7,
  },
  participantRow: {
    alignItems: "stretch",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: "row",
    overflow: "hidden",
  },
  participantMain: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 58,
    paddingHorizontal: 11,
  },
  personIcon: {
    alignItems: "center",
    backgroundColor: colors.blueSoft,
    borderRadius: 5,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  participantCopy: {
    flex: 1,
    minWidth: 0,
  },
  participantName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  participantMeta: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  removeButton: {
    alignItems: "center",
    borderLeftColor: colors.border,
    borderLeftWidth: 1,
    justifyContent: "center",
    width: 48,
  },
  deleteButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderColor: colors.danger,
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    minHeight: 42,
    paddingHorizontal: 13,
  },
  deleteText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "700",
  },
  empty: {
    color: colors.textMuted,
    fontSize: 16,
    paddingVertical: 20,
    textAlign: "center",
  },
  emptyInline: {
    color: colors.textMuted,
    fontSize: 14,
    paddingVertical: 7,
  },
  error: {
    color: colors.danger,
    fontSize: 14,
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.5,
  },
});
