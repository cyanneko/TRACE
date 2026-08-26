import type { MemoryEntry } from "@trace/contracts";
import { ChevronDown, ChevronUp, Database } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { memoryDetail, memorySourceLabel, memoryTitle, memoryTypeLabel } from "../memory/presentation";
import { colors } from "../theme";

type Props = {
  memories: MemoryEntry[];
};

export function ActiveMemoryDisclosure({ memories }: Props) {
  const [expanded, setExpanded] = useState(false);
  const orderedMemories = useMemo(
    () => [...memories].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    [memories],
  );
  const count = memories.length;
  const memoryLabel = count === 1 ? "memory" : "memories";

  if (count === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Pressable
        aria-expanded={expanded}
        accessibilityLabel={`${expanded ? "Hide" : "Show"} ${count} active ${memoryLabel}`}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((current) => !current)}
        style={({ pressed }) => [styles.header, pressed && styles.headerPressed]}
      >
        <Database color={colors.blue} size={18} strokeWidth={2} />
        <View style={styles.headerCopy}>
          <Text style={styles.title}>{count} active {memoryLabel} ready</Text>
          <Text style={styles.detail}>Included as context for this thread.</Text>
        </View>
        {expanded ? (
          <ChevronUp color={colors.textMuted} size={18} strokeWidth={2} />
        ) : (
          <ChevronDown color={colors.textMuted} size={18} strokeWidth={2} />
        )}
      </Pressable>

      {expanded ? (
        <View accessibilityLabel="Active memories" style={styles.list}>
          {orderedMemories.map((memory) => (
            <View key={memory.id} style={styles.item}>
              <View style={styles.itemHeading}>
                <Text numberOfLines={2} style={styles.itemTitle}>{memoryTitle(memory)}</Text>
                <Text style={styles.type}>{memoryTypeLabel(memory)}</Text>
              </View>
              <Text style={styles.itemDetail}>{memoryDetail(memory)}</Text>
              <Text style={styles.source}>{memorySourceLabel(memory)}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderLeftColor: colors.blue,
    borderLeftWidth: 3,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    minHeight: 48,
    paddingLeft: 12,
    paddingRight: 4,
    paddingVertical: 4,
  },
  headerPressed: {
    opacity: 0.68,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  detail: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  list: {
    marginLeft: 40,
    paddingRight: 4,
  },
  item: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: 4,
    paddingVertical: 10,
  },
  itemHeading: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
  },
  itemTitle: {
    color: colors.text,
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
    minWidth: 0,
  },
  type: {
    color: colors.blue,
    flexShrink: 0,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 20,
  },
  itemDetail: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  source: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
});
