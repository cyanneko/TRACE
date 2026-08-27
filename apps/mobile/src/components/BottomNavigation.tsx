import { CalendarDays, Database, Settings, Sparkles, UsersRound } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "../theme";

export type MainTab = "memory" | "meetings" | "analyze" | "contacts";

type Props = {
  activeTab: MainTab;
  contactCount: number;
  meetingCount: number;
  onChange: (tab: MainTab) => void;
  onOpenSettings: () => void;
  settingsActive: boolean;
};

export function BottomNavigation({
  activeTab,
  contactCount,
  meetingCount,
  onChange,
  onOpenSettings,
  settingsActive,
}: Props) {
  const tabActive = (tab: MainTab) => !settingsActive && activeTab === tab;

  return (
    <View style={styles.bar}>
      <View accessibilityRole="tablist" style={styles.inner}>
        <EdgeTab
          active={tabActive("memory")}
          icon="memory"
          label="Memory"
          accessibilityLabel="Global memory"
          onPress={() => onChange("memory")}
        />
        <SecondaryTab
          active={tabActive("meetings")}
          count={meetingCount}
          icon="meetings"
          label="Meetings"
          onPress={() => onChange("meetings")}
        />
        <Pressable
          accessibilityLabel="Analyze"
          accessibilityRole="tab"
          accessibilityState={{ selected: tabActive("analyze") }}
          aria-selected={tabActive("analyze")}
          onPress={() => onChange("analyze")}
          style={({ pressed }) => [
            styles.analyzeTab,
            tabActive("analyze") && styles.analyzeTabActive,
            pressed && styles.tabPressed,
          ]}
        >
          <Sparkles color="#FFFFFF" size={22} strokeWidth={2.2} />
          <Text style={styles.analyzeLabel}>Analyze</Text>
        </Pressable>
        <SecondaryTab
          active={tabActive("contacts")}
          count={contactCount}
          icon="contacts"
          label="Contacts"
          onPress={() => onChange("contacts")}
        />
        <EdgeTab
          active={settingsActive}
          icon="settings"
          label="Settings"
          accessibilityLabel="Provider settings"
          onPress={onOpenSettings}
        />
      </View>
    </View>
  );
}

type EdgeTabProps = {
  accessibilityLabel: string;
  active: boolean;
  icon: "memory" | "settings";
  label: string;
  onPress: () => void;
};

function EdgeTab({ accessibilityLabel, active, icon, label, onPress }: EdgeTabProps) {
  const Icon = icon === "memory" ? Database : Settings;
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      aria-selected={active}
      onPress={onPress}
      style={({ pressed }) => [styles.edgeTab, active && styles.edgeTabActive, pressed && styles.tabPressed]}
    >
      <Icon color={active ? colors.primary : colors.textMuted} size={19} strokeWidth={2} />
      <Text numberOfLines={1} style={[styles.edgeLabel, active && styles.labelActive]}>
        {label}
      </Text>
    </Pressable>
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
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  inner: {
    alignSelf: "center",
    flexDirection: "row",
    gap: 4,
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
  edgeTab: {
    alignItems: "center",
    borderRadius: 6,
    flexShrink: 0,
    gap: 3,
    justifyContent: "center",
    minHeight: 54,
    paddingHorizontal: 2,
    width: 52,
  },
  edgeTabActive: {
    backgroundColor: colors.primarySoft,
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
    gap: 5,
    justifyContent: "center",
    minHeight: 54,
    minWidth: 0,
    paddingHorizontal: 6,
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
  edgeLabel: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: "700",
  },
  analyzeLabel: {
    color: "#FFFFFF",
    fontSize: 14,
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
