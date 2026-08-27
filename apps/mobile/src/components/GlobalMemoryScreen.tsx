import type { EntityMemory } from "@trace/contracts";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";

import { colors } from "../theme";
import { EntityMemoryEditor } from "./EntityMemoryEditor";

type Props = {
  error: string | null;
  loading: boolean;
  memories: EntityMemory[];
  onAdd: (content: string) => Promise<void>;
  onDelete: (memoryId: string) => Promise<void>;
  onUpdate: (memoryId: string, content: string) => Promise<void>;
};

export function GlobalMemoryScreen({ error, loading, memories, onAdd, onDelete, onUpdate }: Props) {
  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <View style={styles.content}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} size="small" />
          </View>
        ) : (
          <EntityMemoryEditor
            memories={memories}
            onAdd={onAdd}
            onDelete={onDelete}
            onUpdate={onUpdate}
            standalone
            title="Global memory"
          />
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
    maxWidth: 680,
    width: "100%",
  },
  error: {
    backgroundColor: colors.dangerSoft,
    borderColor: "#EBC4C4",
    borderRadius: 6,
    borderWidth: 1,
    color: colors.danger,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 18,
    padding: 12,
  },
  loading: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 220,
  },
});
