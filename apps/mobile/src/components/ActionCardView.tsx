import type { ActionCard, Evidence } from "@trace/contracts";
import {
  CalendarClock,
  CalendarPlus,
  CheckSquare2,
  Square,
  UserPen,
  UserPlus,
} from "lucide-react-native";
import type { ComponentType } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { colors } from "../theme";
import { DateTimeField } from "./DateTimeField";

type Props = {
  card: ActionCard;
  evidence: Evidence[];
  onChange: (card: ActionCard) => void;
  onToggle: () => void;
  selected: boolean;
};

const cardMeta: Record<
  ActionCard["type"],
  { icon: ComponentType<{ color?: string; size?: number; strokeWidth?: number }>; label: string }
> = {
  create_meeting: { icon: CalendarPlus, label: "Meeting" },
  update_meeting: { icon: CalendarClock, label: "Meeting update" },
  create_contact: { icon: UserPlus, label: "New contact" },
  update_contact: { icon: UserPen, label: "Contact update" },
};

export function ActionCardView({ card, evidence, onChange, onToggle, selected }: Props) {
  const meta = cardMeta[card.type];
  const Icon = meta.icon;
  const confidence = Math.round(card.confidence * 100);

  return (
    <View style={[styles.card, !selected && styles.cardUnselected]}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel={selected ? `Exclude ${card.title}` : `Include ${card.title}`}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: selected }}
          hitSlop={8}
          onPress={onToggle}
          style={styles.checkbox}
        >
          {selected ? (
            <CheckSquare2 color={colors.primary} size={23} strokeWidth={2.1} />
          ) : (
            <Square color={colors.textMuted} size={23} strokeWidth={1.8} />
          )}
        </Pressable>
        <View style={styles.iconBox}>
          <Icon color={colors.blue} size={19} strokeWidth={2} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.kind}>{meta.label}</Text>
          <Text style={styles.title}>{card.title}</Text>
        </View>
        <View style={[styles.confidence, confidence < 80 && styles.confidenceCaution]}>
          <Text style={[styles.confidenceText, confidence < 80 && styles.confidenceTextCaution]}>
            {confidence}%
          </Text>
        </View>
      </View>

      {selected ? <Fields card={card} onChange={onChange} /> : null}

      {card.riskFlags.length > 0 ? (
        <View style={styles.risks}>
          {card.riskFlags.map((risk) => (
            <Text key={risk} style={styles.riskText}>
              {risk.replaceAll("_", " ")}
            </Text>
          ))}
        </View>
      ) : null}

      {evidence.length > 0 ? (
        <View style={styles.evidence}>
          <Text style={styles.evidenceLabel}>Evidence</Text>
          {evidence.map((item) => (
            <Text key={item.id} style={styles.quote}>
              “{item.quote}”
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function Fields({ card, onChange }: Pick<Props, "card" | "onChange">) {
  if (card.type === "create_meeting") {
    const updateStartAt = (startAt: string | undefined) => {
      if (!startAt) {
        onChange({ ...card, payload: { ...card.payload, startAt: null } });
        return;
      }
      const previousStart = card.payload.startAt ? new Date(card.payload.startAt) : null;
      const previousEnd = card.payload.endAt ? new Date(card.payload.endAt) : null;
      const duration =
        previousStart && previousEnd
          ? Math.max(0, previousEnd.getTime() - previousStart.getTime())
          : 30 * 60 * 1_000;
      onChange({
        ...card,
        payload: {
          ...card.payload,
          startAt,
          endAt: new Date(new Date(startAt).getTime() + duration).toISOString(),
        },
      });
    };
    return (
      <View style={styles.fields}>
        <Field
          label="Title"
          onChangeText={(title) => onChange({ ...card, payload: { ...card.payload, title } })}
          value={card.payload.title}
        />
        <View style={styles.fieldRow}>
          <DateTimeField
            label="Starts"
            onChange={updateStartAt}
            timezone={card.payload.timezone}
            value={card.payload.startAt ?? undefined}
          />
          <DateTimeField
            label="Ends"
            onChange={(endAt) =>
              onChange({ ...card, payload: { ...card.payload, endAt: endAt ?? null } })
            }
            timezone={card.payload.timezone}
            value={card.payload.endAt ?? undefined}
          />
        </View>
        <Field
          label="Notes"
          multiline
          onChangeText={(notes) => onChange({ ...card, payload: { ...card.payload, notes } })}
          value={card.payload.notes}
        />
      </View>
    );
  }

  if (card.type === "create_contact") {
    return (
      <View style={styles.fields}>
        <Field
          label="Name"
          onChangeText={(displayName) => onChange({ ...card, payload: { ...card.payload, displayName } })}
          value={card.payload.displayName}
        />
        <View style={styles.fieldRow}>
          <Field
            label="Company"
            onChangeText={(company) => onChange({ ...card, payload: { ...card.payload, company } })}
            value={card.payload.company}
          />
          <Field
            label="Role"
            onChangeText={(jobTitle) => onChange({ ...card, payload: { ...card.payload, jobTitle } })}
            value={card.payload.jobTitle}
          />
        </View>
        <View style={styles.fieldRow}>
          <Field
            label="Phone"
            onChangeText={(phone) =>
              onChange({ ...card, payload: { ...card.payload, phones: phone ? [phone] : [] } })
            }
            value={card.payload.phones[0] ?? ""}
          />
          <Field
            label="Email"
            onChangeText={(email) =>
              onChange({ ...card, payload: { ...card.payload, emails: email ? [email] : [] } })
            }
            value={card.payload.emails[0] ?? ""}
          />
        </View>
      </View>
    );
  }

  if (card.type === "update_meeting") {
    const timezoneChange = card.payload.changes.find((change) => change.field === "timezone");
    const timezone =
      (timezoneChange?.field === "timezone" ? timezoneChange.nextValue : null) ||
      Intl.DateTimeFormat().resolvedOptions().timeZone ||
      "UTC";
    return (
      <View style={styles.fields}>
        <Field label="Meeting" onChangeText={() => undefined} readOnly value={card.payload.displayTitle} />
        {card.payload.changes.map((change, index) => (
          <View key={`${change.field}-${index}`} style={styles.changeRow}>
            <View style={styles.changeLabel}>
              <Text style={styles.changeField}>{change.field}</Text>
              <Text numberOfLines={1} style={styles.previousValue}>
                {formatMeetingChangeValue(change.field, change.previousValue) || "No existing value"}
              </Text>
            </View>
            {change.field === "startAt" || change.field === "endAt" ? (
              <DateTimeField
                label="New date and time"
                onChange={(nextValue) => {
                  const changes = card.payload.changes.map((item, itemIndex) =>
                    itemIndex === index && (item.field === "startAt" || item.field === "endAt")
                      ? { ...item, nextValue: nextValue ?? null }
                      : item,
                  );
                  onChange({ ...card, payload: { ...card.payload, changes } });
                }}
                timezone={timezone}
                value={change.nextValue ?? undefined}
              />
            ) : (
              <Field
                label="New value"
                onChangeText={(nextValue) => {
                  const changes = card.payload.changes.map((item, itemIndex) => {
                    if (itemIndex !== index) return item;
                    if (item.field === "participantContactIds") {
                      return {
                        ...item,
                        nextValue: nextValue
                          .split(",")
                          .map((value) => value.trim())
                          .filter(Boolean),
                      };
                    }
                    if (item.field === "title" || item.field === "timezone") {
                      return { ...item, nextValue };
                    }
                    return { ...item, nextValue: nextValue || null };
                  });
                  onChange({ ...card, payload: { ...card.payload, changes } });
                }}
                value={formatMeetingChangeValue(change.field, change.nextValue)}
              />
            )}
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.fields}>
      <Field label="Contact" onChangeText={() => undefined} readOnly value={card.payload.displayName} />
      {card.payload.changes.map((change, index) => (
        <View key={`${change.field}-${index}`} style={styles.changeRow}>
          <View style={styles.changeLabel}>
            <Text style={styles.changeField}>{change.field}</Text>
            <Text numberOfLines={1} style={styles.previousValue}>
              {change.previousValue || "No existing value"}
            </Text>
          </View>
          <Field
            label="New value"
            onChangeText={(nextValue) => {
              const changes = card.payload.changes.map((item, itemIndex) =>
                itemIndex === index ? { ...item, nextValue } : item,
              );
              onChange({ ...card, payload: { ...card.payload, changes } });
            }}
            value={change.nextValue}
          />
        </View>
      ))}
    </View>
  );
}

function formatMeetingChangeValue(field: string, value: string | string[] | null): string {
  if (Array.isArray(value)) return value.join(", ");
  if ((field === "startAt" || field === "endAt") && value) {
    const date = new Date(value);
    if (Number.isFinite(date.getTime())) {
      return date.toLocaleString(undefined, {
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        month: "short",
        year: "numeric",
      });
    }
  }
  return value ?? "";
}

type FieldProps = {
  label: string;
  multiline?: boolean;
  onChangeText: (value: string) => void;
  readOnly?: boolean;
  value: string;
};

function Field({ label, multiline, onChangeText, readOnly, value }: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        editable={!readOnly}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.primary}
        style={[styles.input, multiline && styles.inputMultiline, readOnly && styles.inputReadOnly]}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 16,
    padding: 18,
    shadowColor: colors.shadow,
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
  },
  cardUnselected: {
    backgroundColor: colors.surfaceMuted,
    opacity: 0.78,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  checkbox: {
    alignItems: "center",
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  iconBox: {
    alignItems: "center",
    backgroundColor: colors.blueSoft,
    borderRadius: 6,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  kind: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    marginTop: 2,
  },
  confidence: {
    backgroundColor: colors.primarySoft,
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  confidenceCaution: {
    backgroundColor: colors.orangeSoft,
  },
  confidenceText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "700",
  },
  confidenceTextCaution: {
    color: colors.orange,
  },
  fields: {
    gap: 12,
  },
  fieldRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  field: {
    flex: 1,
    gap: 6,
    minWidth: 180,
  },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "600",
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 6,
    borderWidth: 1,
    color: colors.text,
    fontSize: 14,
    minHeight: 42,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  inputMultiline: {
    minHeight: 68,
    textAlignVertical: "top",
  },
  inputReadOnly: {
    backgroundColor: colors.surfaceMuted,
  },
  changeRow: {
    alignItems: "flex-end",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  changeLabel: {
    minWidth: 150,
    paddingBottom: 8,
  },
  changeField: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  previousValue: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 3,
  },
  risks: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  riskText: {
    backgroundColor: colors.orangeSoft,
    borderRadius: 10,
    color: colors.orange,
    fontSize: 11,
    fontWeight: "600",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  evidence: {
    borderLeftColor: colors.blue,
    borderLeftWidth: 2,
    gap: 5,
    paddingLeft: 12,
  },
  evidenceLabel: {
    color: colors.blue,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  quote: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
});
