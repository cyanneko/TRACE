import type { EntityMemory } from "@trace/contracts";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { colors } from "../theme";

type MemoryKind = EntityMemory["kind"];

type Props = {
  memories: EntityMemory[];
  onAdd: (kind: MemoryKind, content: string) => Promise<void>;
  onDelete: (memoryId: string) => Promise<void>;
  onUpdate: (memoryId: string, kind: MemoryKind, content: string) => Promise<void>;
};

const kinds: Array<{ label: string; value: MemoryKind }> = [
  { label: "Context", value: "context" },
  { label: "Preference", value: "preference" },
  { label: "Commitment", value: "commitment" },
  { label: "Note", value: "note" },
];

export function EntityMemoryEditor({ memories, onAdd, onDelete, onUpdate }: Props) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [kind, setKind] = useState<MemoryKind>("context");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (editingId && !memories.some((memory) => memory.id === editingId)) {
      setEditingId(null);
      setKind("context");
      setContent("");
    }
  }, [editingId, memories]);

  function cancel() {
    setAdding(false);
    setEditingId(null);
    setKind("context");
    setContent("");
  }

  function edit(memory: EntityMemory) {
    setAdding(false);
    setEditingId(memory.id);
    setKind(memory.kind);
    setContent(memory.content);
  }

  async function save() {
    const value = content.trim();
    if (!value || busy) return;
    setBusy(true);
    try {
      if (editingId) await onUpdate(editingId, kind, value);
      else await onAdd(kind, value);
      cancel();
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        <View>
          <Text style={styles.eyebrow}>MEMORY</Text>
          <Text style={styles.title}>Dedicated context</Text>
        </View>
        <Pressable
          accessibilityLabel="Add memory"
          hitSlop={6}
          onPress={() => {
            cancel();
            setAdding(true);
          }}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <Plus color={colors.primary} size={20} strokeWidth={2.2} />
        </Pressable>
      </View>

      {adding ? (
        <MemoryForm
          busy={busy}
          content={content}
          kind={kind}
          onCancel={cancel}
          onChangeContent={setContent}
          onChangeKind={setKind}
          onSave={() => void save()}
        />
      ) : null}

      {memories.length === 0 && !adding ? <Text style={styles.empty}>No memory yet.</Text> : null}

      <View style={styles.list}>
        {memories.map((memory) =>
          editingId === memory.id ? (
            <MemoryForm
              busy={busy}
              content={content}
              key={memory.id}
              kind={kind}
              onCancel={cancel}
              onChangeContent={setContent}
              onChangeKind={setKind}
              onSave={() => void save()}
            />
          ) : (
            <View key={memory.id} style={styles.memoryRow}>
              <View style={styles.memoryCopy}>
                <Text style={styles.kind}>{memory.kind}</Text>
                <Text style={styles.content}>{memory.content}</Text>
              </View>
              <View style={styles.actions}>
                <Pressable
                  accessibilityLabel="Edit memory"
                  hitSlop={6}
                  onPress={() => edit(memory)}
                  style={({ pressed }) => [styles.smallButton, pressed && styles.pressed]}
                >
                  <Pencil color={colors.blue} size={17} strokeWidth={2} />
                </Pressable>
                <Pressable
                  accessibilityLabel="Delete memory"
                  hitSlop={6}
                  onPress={() => void onDelete(memory.id)}
                  style={({ pressed }) => [styles.smallButton, pressed && styles.pressed]}
                >
                  <Trash2 color={colors.danger} size={17} strokeWidth={2} />
                </Pressable>
              </View>
            </View>
          ),
        )}
      </View>
    </View>
  );
}

type MemoryFormProps = {
  busy: boolean;
  content: string;
  kind: MemoryKind;
  onCancel: () => void;
  onChangeContent: (value: string) => void;
  onChangeKind: (kind: MemoryKind) => void;
  onSave: () => void;
};

function MemoryForm({
  busy,
  content,
  kind,
  onCancel,
  onChangeContent,
  onChangeKind,
  onSave,
}: MemoryFormProps) {
  return (
    <View style={styles.form}>
      <View accessibilityRole="tablist" style={styles.kindPicker}>
        {kinds.map((item) => (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: kind === item.value }}
            key={item.value}
            onPress={() => onChangeKind(item.value)}
            style={[styles.kindOption, kind === item.value && styles.kindOptionActive]}
          >
            <Text style={[styles.kindOptionText, kind === item.value && styles.kindOptionTextActive]}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        maxLength={2_000}
        multiline
        onChangeText={onChangeContent}
        placeholder="Memory"
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.primary}
        style={styles.input}
        value={content}
      />
      <View style={styles.formActions}>
        <Pressable accessibilityLabel="Cancel" onPress={onCancel} style={styles.formButton}>
          <X color={colors.textMuted} size={18} strokeWidth={2} />
        </Pressable>
        <Pressable
          accessibilityLabel="Save memory"
          disabled={busy || !content.trim()}
          onPress={onSave}
          style={[styles.saveButton, (busy || !content.trim()) && styles.disabled]}
        >
          <Check color="#FFFFFF" size={18} strokeWidth={2.2} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: 14,
    paddingTop: 22,
  },
  heading: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  eyebrow: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "800",
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
    marginTop: 3,
  },
  iconButton: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: 6,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  list: {
    gap: 8,
  },
  memoryRow: {
    alignItems: "flex-start",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 72,
    padding: 13,
  },
  memoryCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  kind: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  content: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
  },
  actions: {
    flexDirection: "row",
    gap: 3,
  },
  smallButton: {
    alignItems: "center",
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  empty: {
    color: colors.textMuted,
    fontSize: 15,
    paddingVertical: 8,
  },
  form: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 6,
    borderWidth: 1,
    gap: 11,
    padding: 12,
  },
  kindPicker: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  kindOption: {
    alignItems: "center",
    borderRadius: 4,
    flexGrow: 1,
    minHeight: 34,
    minWidth: 90,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  kindOptionActive: {
    backgroundColor: colors.primarySoft,
  },
  kindOptionText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  kindOptionTextActive: {
    color: colors.primary,
  },
  input: {
    borderColor: colors.border,
    borderRadius: 6,
    borderWidth: 1,
    color: colors.text,
    fontSize: 15,
    minHeight: 88,
    paddingHorizontal: 11,
    paddingVertical: 10,
    textAlignVertical: "top",
  },
  formActions: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "flex-end",
  },
  formButton: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 6,
    borderWidth: 1,
    height: 38,
    justifyContent: "center",
    width: 42,
  },
  saveButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 6,
    height: 38,
    justifyContent: "center",
    width: 42,
  },
  pressed: {
    opacity: 0.68,
  },
  disabled: {
    opacity: 0.45,
  },
});
