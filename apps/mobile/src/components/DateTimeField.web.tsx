import type { ChangeEvent, CSSProperties } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors } from "../theme";
import { fromLocalDateTimeInput, toLocalDateTimeInput } from "./dateTimeValue";

export type DateTimeFieldProps = {
  label: string;
  onChange: (value: string | undefined) => void;
  timezone: string;
  value?: string;
};

const inputStyle: CSSProperties = {
  backgroundColor: colors.surface,
  border: `1px solid ${colors.border}`,
  borderRadius: 6,
  boxSizing: "border-box",
  color: colors.text,
  fontFamily: "inherit",
  fontSize: 16,
  height: 46,
  minWidth: 0,
  padding: "8px 10px",
  width: "100%",
};

export function DateTimeField({ label, onChange, timezone, value }: DateTimeFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <input
        aria-label={label}
        onChange={(event: ChangeEvent<HTMLInputElement>) =>
          onChange(fromLocalDateTimeInput(event.currentTarget.value))
        }
        style={inputStyle}
        type="datetime-local"
        value={toLocalDateTimeInput(value)}
      />
      <Text numberOfLines={1} style={styles.timezone}>{timezone || "Device timezone"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flex: 1,
    gap: 6,
    minWidth: 220,
  },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  timezone: {
    color: colors.textMuted,
    fontSize: 11,
  },
});
