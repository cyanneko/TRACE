import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { CalendarClock, Check, X } from "lucide-react-native";
import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "../theme";
import { defaultPickerDate, parseDateTime } from "./dateTimeValue";

export type DateTimeFieldProps = {
  label: string;
  onChange: (value: string | undefined) => void;
  timezone: string;
  value?: string;
};

function formattedValue(value?: string): string {
  const date = parseDateTime(value);
  if (!date) return "Set date and time";
  return date.toLocaleString(undefined, {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function DateTimeField({ label, onChange, timezone, value }: DateTimeFieldProps) {
  const [open, setOpen] = useState(false);
  const pickerValue = parseDateTime(value) ?? defaultPickerDate();

  function openAndroidPicker() {
    DateTimePickerAndroid.open({
      mode: "date",
      onChange: (event, selectedDate) => {
        if (event.type !== "set" || !selectedDate) return;
        DateTimePickerAndroid.open({
          mode: "time",
          onChange: (timeEvent, selectedTime) => {
            if (timeEvent.type === "set" && selectedTime) onChange(selectedTime.toISOString());
          },
          timeZoneName: timezone || undefined,
          value: selectedDate,
        });
      },
      timeZoneName: timezone || undefined,
      value: pickerValue,
    });
  }

  function showPicker() {
    if (Platform.OS === "android") openAndroidPicker();
    else setOpen(true);
  }

  function updateValue(event: DateTimePickerEvent, selectedDate?: Date) {
    if (event.type === "set" && selectedDate) onChange(selectedDate.toISOString());
  }

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.valueRow}>
        <Pressable
          accessibilityLabel={`Choose ${label.toLocaleLowerCase()}`}
          onPress={showPicker}
          style={({ pressed }) => [styles.valueButton, pressed && styles.pressed]}
        >
          <CalendarClock color={colors.blue} size={18} strokeWidth={2} />
          <Text numberOfLines={1} style={[styles.value, !value && styles.placeholder]}>
            {formattedValue(value)}
          </Text>
        </Pressable>
        {value ? (
          <Pressable
            accessibilityLabel={`Clear ${label.toLocaleLowerCase()}`}
            onPress={() => onChange(undefined)}
            style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}
          >
            <X color={colors.textMuted} size={18} strokeWidth={2} />
          </Pressable>
        ) : null}
      </View>
      <Text numberOfLines={1} style={styles.timezone}>{timezone || "Device timezone"}</Text>
      {open && Platform.OS === "ios" ? (
        <View style={styles.pickerPanel}>
          <DateTimePicker
            accentColor={colors.primary}
            display="spinner"
            mode="datetime"
            onChange={updateValue}
            themeVariant="light"
            timeZoneName={timezone || undefined}
            value={pickerValue}
          />
          <Pressable
            accessibilityLabel={`Done editing ${label.toLocaleLowerCase()}`}
            onPress={() => setOpen(false)}
            style={({ pressed }) => [styles.doneButton, pressed && styles.pressed]}
          >
            <Check color="#FFFFFF" size={19} strokeWidth={2.2} />
          </Pressable>
        </View>
      ) : null}
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
  valueRow: {
    alignItems: "stretch",
    borderColor: colors.border,
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: "row",
    overflow: "hidden",
  },
  valueButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    flex: 1,
    flexDirection: "row",
    gap: 8,
    minHeight: 45,
    minWidth: 0,
    paddingHorizontal: 11,
  },
  value: {
    color: colors.text,
    flex: 1,
    fontSize: 15,
  },
  placeholder: {
    color: colors.textMuted,
  },
  clearButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderLeftColor: colors.border,
    borderLeftWidth: 1,
    justifyContent: "center",
    width: 42,
  },
  timezone: {
    color: colors.textMuted,
    fontSize: 11,
  },
  pickerPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 6,
    borderWidth: 1,
    overflow: "hidden",
    paddingBottom: 8,
  },
  doneButton: {
    alignItems: "center",
    alignSelf: "flex-end",
    backgroundColor: colors.primary,
    borderRadius: 6,
    height: 38,
    justifyContent: "center",
    marginRight: 8,
    width: 42,
  },
  pressed: {
    opacity: 0.72,
  },
});
