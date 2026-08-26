import type { ContactRecord, EntityMemory } from "@trace/contracts";
import {
  ArrowLeft,
  ChevronRight,
  Plus,
  Save,
  Search,
  Trash2,
  UserRound,
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import { sortContacts } from "../entities/presentation";
import { colors } from "../theme";
import { EntityMemoryEditor } from "./EntityMemoryEditor";

type MemoryKind = EntityMemory["kind"];

type Props = {
  contacts: ContactRecord[];
  error: string | null;
  loading: boolean;
  memories: EntityMemory[];
  onAddMemory: (contactId: string, kind: MemoryKind, content: string) => Promise<void>;
  onCreate: () => Promise<void>;
  onDelete: (contactId: string) => Promise<void>;
  onDeleteMemory: (memoryId: string) => Promise<void>;
  onSave: (contact: ContactRecord) => Promise<void>;
  onSelect: (contactId: string | null) => void;
  onUpdateMemory: (memoryId: string, kind: MemoryKind, content: string) => Promise<void>;
  selectedContactId: string | null;
};

export function ContactsScreen({
  contacts,
  error,
  loading,
  memories,
  onAddMemory,
  onCreate,
  onDelete,
  onDeleteMemory,
  onSave,
  onSelect,
  onUpdateMemory,
  selectedContactId,
}: Props) {
  const selected = contacts.find((contact) => contact.id === selectedContactId);
  if (selected) {
    return (
      <ContactDetail
        contact={selected}
        error={error}
        memories={memories.filter(
          (memory) => memory.ownerType === "contact" && memory.ownerId === selected.id,
        )}
        onAddMemory={(kind, content) => onAddMemory(selected.id, kind, content)}
        onBack={() => onSelect(null)}
        onDelete={async () => {
          await onDelete(selected.id);
          onSelect(null);
        }}
        onDeleteMemory={onDeleteMemory}
        onSave={onSave}
        onUpdateMemory={onUpdateMemory}
      />
    );
  }

  return (
    <ContactList
      contacts={contacts}
      error={error}
      loading={loading}
      memories={memories}
      onCreate={onCreate}
      onSelect={(contactId) => onSelect(contactId)}
    />
  );
}

function ContactList({
  contacts,
  error,
  loading,
  memories,
  onCreate,
  onSelect,
}: Pick<Props, "contacts" | "error" | "loading" | "memories" | "onCreate"> & {
  onSelect: (contactId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const sorted = useMemo(() => sortContacts(contacts), [contacts]);
  const visible = sorted.filter((contact) =>
    `${contact.displayName} ${contact.company ?? ""} ${contact.jobTitle ?? ""}`
      .toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase()),
  );
  const memoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const memory of memories) {
      if (memory.ownerType === "contact" && memory.status === "active") {
        counts.set(memory.ownerId, (counts.get(memory.ownerId) ?? 0) + 1);
      }
    }
    return counts;
  }, [memories]);

  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <View style={styles.content}>
        <View style={styles.pageHeading}>
          <View>
            <Text style={styles.eyebrow}>CONTACTS</Text>
            <Text style={styles.pageTitle}>People</Text>
          </View>
          <Pressable
            accessibilityLabel="Create contact"
            onPress={() => void onCreate()}
            style={({ pressed }) => [styles.createButton, pressed && styles.pressed]}
          >
            <Plus color="#FFFFFF" size={21} strokeWidth={2.2} />
          </Pressable>
        </View>

        <View style={styles.searchBox}>
          <Search color={colors.textMuted} size={18} strokeWidth={2} />
          <TextInput
            onChangeText={setQuery}
            placeholder="Search contacts"
            placeholderTextColor={colors.textMuted}
            selectionColor={colors.primary}
            style={styles.searchInput}
            value={query}
          />
        </View>

        {loading ? <ActivityIndicator color={colors.primary} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!loading && visible.length === 0 ? <Text style={styles.empty}>No contacts.</Text> : null}

        <View style={styles.rows}>
          {visible.map((contact) => (
            <Pressable
              accessibilityLabel={`Open ${contact.displayName || "unnamed contact"}`}
              key={contact.id}
              onPress={() => onSelect(contact.id)}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <View style={styles.avatar}>
                <UserRound color={contact.isSelf ? colors.orange : colors.blue} size={20} strokeWidth={2} />
              </View>
              <View style={styles.rowCopy}>
                <View style={styles.nameLine}>
                  <Text numberOfLines={1} style={styles.rowTitle}>
                    {contact.displayName || "Unnamed contact"}
                  </Text>
                  {contact.isSelf ? <Text style={styles.selfBadge}>Me</Text> : null}
                </View>
                <Text numberOfLines={1} style={styles.rowMeta}>
                  {[contact.company, contact.jobTitle].filter(Boolean).join(" · ") ||
                    `${memoryCounts.get(contact.id) ?? 0} memories`}
                </Text>
              </View>
              <ChevronRight color={colors.textMuted} size={19} strokeWidth={2} />
            </Pressable>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

type ContactDetailProps = {
  contact: ContactRecord;
  error: string | null;
  memories: EntityMemory[];
  onAddMemory: (kind: MemoryKind, content: string) => Promise<void>;
  onBack: () => void;
  onDelete: () => Promise<void>;
  onDeleteMemory: (memoryId: string) => Promise<void>;
  onSave: (contact: ContactRecord) => Promise<void>;
  onUpdateMemory: (memoryId: string, kind: MemoryKind, content: string) => Promise<void>;
};

function ContactDetail({
  contact,
  error,
  memories,
  onAddMemory,
  onBack,
  onDelete,
  onDeleteMemory,
  onSave,
  onUpdateMemory,
}: ContactDetailProps) {
  const [draft, setDraft] = useState(contact);
  const [saving, setSaving] = useState(false);

  useEffect(() => setDraft(contact), [contact.id]);

  async function save() {
    setSaving(true);
    try {
      await onSave({
        ...draft,
        status: draft.displayName.trim() ? "active" : "draft",
        updatedAt: new Date().toISOString(),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <View style={styles.content}>
        <View style={styles.detailHeading}>
          <Pressable accessibilityLabel="Back to contacts" hitSlop={6} onPress={onBack} style={styles.backButton}>
            <ArrowLeft color={colors.text} size={21} strokeWidth={2} />
          </Pressable>
          <View style={styles.detailHeadingCopy}>
            <Text style={styles.eyebrow}>CONTACT</Text>
            <Text numberOfLines={1} style={styles.pageTitle}>
              {contact.displayName || "Unnamed contact"}
            </Text>
          </View>
          <Pressable
            accessibilityLabel="Save contact"
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
            label="Name"
            onChangeText={(displayName) => setDraft((current) => ({ ...current, displayName }))}
            value={draft.displayName}
          />
          <View style={styles.fieldRow}>
            <DetailField
              label="Company"
              onChangeText={(company) => setDraft((current) => ({ ...current, company }))}
              value={draft.company ?? ""}
            />
            <DetailField
              label="Role"
              onChangeText={(jobTitle) => setDraft((current) => ({ ...current, jobTitle }))}
              value={draft.jobTitle ?? ""}
            />
          </View>
          <View style={styles.fieldRow}>
            <DetailField
              label="Phone"
              onChangeText={(phone) => setDraft((current) => ({ ...current, phones: phone ? [phone] : [] }))}
              value={draft.phones[0] ?? ""}
            />
            <DetailField
              label="Email"
              onChangeText={(email) => setDraft((current) => ({ ...current, emails: email ? [email] : [] }))}
              value={draft.emails[0] ?? ""}
            />
          </View>
          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.toggleTitle}>This is me</Text>
              <Text style={styles.toggleMeta}>Self context</Text>
            </View>
            <Switch
              onValueChange={(isSelf) => setDraft((current) => ({ ...current, isSelf }))}
              thumbColor="#FFFFFF"
              trackColor={{ false: colors.border, true: colors.primary }}
              value={draft.isSelf}
            />
          </View>
        </View>

        <EntityMemoryEditor
          memories={memories}
          onAdd={onAddMemory}
          onDelete={onDeleteMemory}
          onUpdate={onUpdateMemory}
        />

        <Pressable
          accessibilityLabel="Delete contact"
          onPress={() => void onDelete()}
          style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}
        >
          <Trash2 color={colors.danger} size={18} strokeWidth={2} />
          <Text style={styles.deleteText}>Delete contact</Text>
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
    maxWidth: 820,
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
  searchBox: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: "row",
    gap: 9,
    minHeight: 46,
    paddingHorizontal: 12,
  },
  searchInput: {
    color: colors.text,
    flex: 1,
    fontSize: 16,
    minWidth: 0,
    paddingVertical: 10,
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
    minHeight: 72,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  rowPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  avatar: {
    alignItems: "center",
    backgroundColor: colors.blueSoft,
    borderRadius: 6,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  rowCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  nameLine: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
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
  selfBadge: {
    backgroundColor: colors.orangeSoft,
    borderRadius: 4,
    color: colors.orange,
    fontSize: 10,
    fontWeight: "800",
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  section: {
    gap: 13,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
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
  toggleRow: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 62,
    paddingHorizontal: 13,
  },
  toggleTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  toggleMeta: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
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
