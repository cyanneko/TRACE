import type { FixtureId } from "@trace/contracts";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "../theme";

const options: Array<{ id: FixtureId; label: string }> = [
  { id: "meeting", label: "Meeting" },
  { id: "update-meeting", label: "Reschedule" },
  { id: "new-contact", label: "New contact" },
  { id: "update-contact", label: "Contact update" },
  { id: "contact-meeting", label: "Contact + meeting" },
  { id: "self-meeting", label: "Me + HR" },
  { id: "many-actions", label: "Many" },
  { id: "no-action", label: "None" },
];

type Props = {
  onChange: (value: FixtureId) => void;
  value: FixtureId;
};

export function ScenarioSelector({ onChange, value }: Props) {
  return (
    <View style={styles.group}>
      <Text style={styles.label}>Fixture scenario</Text>
      <View accessibilityRole="tablist" style={styles.options}>
        {options.map((option) => {
          const selected = option.id === value;
          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              key={option.id}
              onPress={() => onChange(option.id)}
              style={({ pressed }) => [
                styles.option,
                selected && styles.optionSelected,
                pressed && styles.optionPressed,
              ]}
            >
              <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: 8,
  },
  label: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "600",
  },
  options: {
    alignItems: "stretch",
    backgroundColor: colors.surfaceMuted,
    borderRadius: 6,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 3,
    padding: 3,
  },
  option: {
    alignItems: "center",
    borderRadius: 4,
    flexBasis: "30%",
    flexGrow: 1,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: 8,
  },
  optionSelected: {
    backgroundColor: colors.surface,
    shadowColor: colors.shadow,
    shadowOffset: { height: 1, width: 0 },
    shadowOpacity: 1,
    shadowRadius: 2,
  },
  optionPressed: {
    opacity: 0.72,
  },
  optionText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  optionTextSelected: {
    color: colors.text,
  },
});
