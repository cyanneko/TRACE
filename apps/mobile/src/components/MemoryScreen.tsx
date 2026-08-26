import type { MemoryEntry } from "@trace/contracts";
import { Database, Trash2 } from "lucide-react-native";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { memoryDetail, memorySourceLabel, memoryTitle, memoryTypeLabel } from "../memory/presentation";
import { colors } from "../theme";

type Props = {
  error: string | null;
  loading: boolean;
  memories: MemoryEntry[];
  newMemoryIds: string[];
  onDeleteMemory: (memoryId: string) => Promise<void>;
};

export function MemoryScreen({ error, loading, memories, newMemoryIds, onDeleteMemory }: Props) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const newIds = useMemo(() => new Set(newMemoryIds), [newMemoryIds]);
  const orderedMemories = useMemo(
    () => [...memories].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    [memories],
  );

  async function remove(memory: MemoryEntry) {
    setDeletingId(memory.id);
    setDeleteError(null);
    try {
      await onDeleteMemory(memory.id);
    } catch {
      setDeleteError("This memory could not be deleted.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <View style={styles.content}>
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.title}>Memory</Text>
          {!loading ? <Text style={styles.count}>{memories.length} active</Text> : null}
        </View>

        {error || deleteError ? (
          <View style={styles.errorBand}>
            <Text style={styles.errorText}>{deleteError ?? error}</Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator color={colors.primary} size="small" />
          </View>
        ) : orderedMemories.length === 0 ? (
          <View style={styles.centerState}>
            <Database color={colors.textMuted} size={25} strokeWidth={1.8} />
            <Text style={styles.emptyTitle}>No active memories</Text>
            <Text style={styles.emptyCopy}>Confirmed facts and open loops will appear here.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {orderedMemories.map((memory) => (
              <View key={memory.id} style={styles.row}>
                <View style={styles.copy}>
                  <View style={styles.rowHeading}>
                    <Text numberOfLines={2} style={styles.memoryTitle}>{memoryTitle(memory)}</Text>
                    <View style={styles.labels}>
                      {newIds.has(memory.id) ? <Text style={styles.newLabel}>New</Text> : null}
                      <Text style={styles.typeLabel}>{memoryTypeLabel(memory)}</Text>
                    </View>
                  </View>
                  <Text style={styles.detail}>{memoryDetail(memory)}</Text>
                  <Text style={styles.source}>{memorySourceLabel(memory)}</Text>
                </View>
                <Pressable
                  accessibilityLabel={`Delete memory ${memoryTitle(memory)}`}
                  disabled={deletingId === memory.id}
                  hitSlop={8}
                  onPress={() => void remove(memory)}
                  style={({ pressed }) => [styles.deleteButton, pressed && styles.deleteButtonPressed]}
                >
                  {deletingId === memory.id ? (
                    <ActivityIndicator color={colors.textMuted} size="small" />
                  ) : (
                    <Trash2 color={colors.textMuted} size={19} strokeWidth={1.9} />
                  )}
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    alignItems: "center",
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  content: {
    gap: 18,
    maxWidth: 680,
    width: "100%",
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 36,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 34,
  },
  count: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "700",
  },
  list: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
  },
  row: {
    alignItems: "flex-start",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    paddingVertical: 15,
  },
  copy: {
    flex: 1,
    gap: 5,
    minWidth: 0,
  },
  rowHeading: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
  },
  memoryTitle: {
    color: colors.text,
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22,
    minWidth: 0,
  },
  labels: {
    alignItems: "flex-end",
    flexShrink: 0,
    gap: 2,
  },
  newLabel: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "800",
  },
  typeLabel: {
    color: colors.blue,
    fontSize: 12,
    fontWeight: "700",
  },
  detail: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  source: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  deleteButton: {
    alignItems: "center",
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  deleteButtonPressed: {
    opacity: 0.6,
  },
  centerState: {
    alignItems: "center",
    flex: 1,
    gap: 8,
    justifyContent: "center",
    minHeight: 220,
    padding: 24,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "700",
  },
  emptyCopy: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  errorBand: {
    backgroundColor: colors.dangerSoft,
    borderColor: "#EBC4C4",
    borderRadius: 6,
    borderWidth: 1,
    padding: 12,
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
    lineHeight: 20,
  },
});
