import { CalendarDays, Sparkles, UsersRound } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "../theme";

export type MainTab = "meetings" | "analyze" | "contacts";

type Props = {
  activeTab: MainTab;
  contactCount: number;
  meetingCount: number;
  onChange: (tab: MainTab) => void;
};

export function BottomNavigation({ activeTab, contactCount, meetingCount, onChange }: Props) {
  return (
    <View style={styles.bar}>
      <View accessibilityRole="tablist" style={styles.inner}>
        <SecondaryTab
          active={activeTab === "meetings"}
          count={meetingCount}
          icon="meetings"
          label="Meetings"
          onPress={() => onChange("meetings")}
        />
        <Pressable
          accessibilityLabel="Analyze"
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === "analyze" }}
          aria-selected={activeTab === "analyze"}
          onPress={() => onChange("analyze")}
          style={({ pressed }) => [
            styles.analyzeTab,
            activeTab === "analyze" && styles.analyzeTabActive,
            pressed && styles.tabPressed,
          ]}
        >
          <Sparkles color="#FFFFFF" size={22} strokeWidth={2.2} />
          <Text style={styles.analyzeLabel}>Analyze</Text>
        </Pressable>
        <SecondaryTab
          active={activeTab === "contacts"}
          count={contactCount}
          icon="contacts"
          label="Contacts"
          onPress={() => onChange("contacts")}
        />
      </View>
    </View>
  );
}

type SecondaryTabProps = {
  active: boolean;
  count: number;
  icon: "contacts" | "meetings";
  label: string;
  onPress: () => void;
};

function SecondaryTab({ active, count, icon, label, onPress }: SecondaryTabProps) {
  const Icon = icon === "meetings" ? CalendarDays : UsersRound;
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      aria-selected={active}
      onPress={onPress}
      style={({ pressed }) => [styles.tab, active && styles.tabActive, pressed && styles.tabPressed]}
    >
      <Icon color={active ? colors.primary : colors.textMuted} size={21} strokeWidth={2} />
      <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
      {count > 0 ? <Text style={[styles.count, active && styles.countActive]}>{count}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  inner: {
    alignSelf: "center",
    flexDirection: "row",
    gap: 7,
    maxWidth: 680,
    width: "100%",
  },
  tab: {
    alignItems: "center",
    borderRadius: 6,
    flex: 1,
    gap: 3,
    justifyContent: "center",
    minHeight: 54,
    minWidth: 0,
    paddingHorizontal: 6,
  },
  tabActive: {
    backgroundColor: colors.primarySoft,
  },
  analyzeTab: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 8,
    flex: 1.12,
    flexDirection: "row",
    gap: 7,
    justifyContent: "center",
    minHeight: 54,
    minWidth: 0,
    paddingHorizontal: 10,
  },
  analyzeTabActive: {
    backgroundColor: colors.blue,
  },
  tabPressed: {
    opacity: 0.72,
  },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  labelActive: {
    color: colors.primary,
  },
  analyzeLabel: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  count: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "700",
    position: "absolute",
    right: 8,
    top: 7,
  },
  countActive: {
    color: colors.primary,
  },
});
