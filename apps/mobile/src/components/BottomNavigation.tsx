import { Database, Sparkles } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "../theme";

export type MainTab = "analyze" | "memory";

type Props = {
  activeTab: MainTab;
  memoryCount: number;
  onChange: (tab: MainTab) => void;
};

export function BottomNavigation({ activeTab, memoryCount, onChange }: Props) {
  return (
    <View style={styles.bar}>
      <View accessibilityRole="tablist" style={styles.inner}>
        <Tab
          active={activeTab === "analyze"}
          icon="analyze"
          label="Analyze"
          onPress={() => onChange("analyze")}
        />
        <Tab
          active={activeTab === "memory"}
          count={memoryCount}
          icon="memory"
          label="Memory"
          onPress={() => onChange("memory")}
        />
      </View>
    </View>
  );
}

type TabProps = {
  active: boolean;
  count?: number;
  icon: "analyze" | "memory";
  label: string;
  onPress: () => void;
};

function Tab({ active, count, icon, label, onPress }: TabProps) {
  const Icon = icon === "analyze" ? Sparkles : Database;

  return (
    <Pressable
      aria-selected={active}
      accessibilityLabel={label}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.tab, active && styles.tabActive, pressed && styles.tabPressed]}
    >
      <Icon color={active ? colors.primary : colors.textMuted} size={21} strokeWidth={2} />
      <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
      {typeof count === "number" && count > 0 ? <Text style={styles.count}>{count}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  inner: {
    alignSelf: "center",
    flexDirection: "row",
    gap: 8,
    maxWidth: 680,
    width: "100%",
  },
  tab: {
    alignItems: "center",
    borderRadius: 6,
    flex: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 50,
    paddingHorizontal: 14,
  },
  tabActive: {
    backgroundColor: colors.primarySoft,
  },
  tabPressed: {
    opacity: 0.7,
  },
  label: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: "700",
  },
  labelActive: {
    color: colors.primary,
  },
  count: {
    color: colors.blue,
    fontSize: 13,
    fontWeight: "800",
  },
});
