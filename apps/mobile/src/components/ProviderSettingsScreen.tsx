import {
  UserVisionProviderSchema,
  VISION_PROVIDER_PRESETS,
  type ProviderInfo,
  type UserVisionProvider,
  type VisionImageDetail,
  type VisionImageFormat,
  type VisionProviderId,
} from "@trace/contracts";
import {
  AlertCircle,
  ArrowLeft,
  Eye,
  EyeOff,
  KeyRound,
  Save,
  ShieldCheck,
} from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import { colors } from "../theme";
import type { ProviderSettingsStorage } from "../providerSettings/types";

type ProviderChoice = "server" | VisionProviderId;

type Props = {
  initialSettings: UserVisionProvider | null;
  onClose: () => void;
  onSave: (settings: UserVisionProvider | null) => Promise<void>;
  serverProvider: ProviderInfo | null;
  storage: ProviderSettingsStorage;
};

const providerChoices: Array<{ id: ProviderChoice; label: string }> = [
  { id: "server", label: "Local default" },
  { id: "fixture", label: "Fixture" },
  { id: "deepseek", label: "DeepSeek" },
  { id: "glm", label: "GLM" },
  { id: "doubao", label: "Doubao" },
  { id: "custom", label: "Custom" },
];

const detailChoices: VisionImageDetail[] = ["auto", "high", "low", "none"];
const formatChoices: Array<{ id: VisionImageFormat; label: string }> = [
  { id: "data-url", label: "Data URL" },
  { id: "base64", label: "Base64" },
];

function presetFor(choice: ProviderChoice) {
  return choice === "deepseek" || choice === "glm" || choice === "doubao"
    ? VISION_PROVIDER_PRESETS[choice]
    : undefined;
}

export function ProviderSettingsScreen({ initialSettings, onClose, onSave, serverProvider, storage }: Props) {
  const initialPreset = initialSettings ? presetFor(initialSettings.provider) : undefined;
  const [choice, setChoice] = useState<ProviderChoice>(initialSettings?.provider ?? "server");
  const [apiKey, setApiKey] = useState(initialSettings?.apiKey ?? "");
  const [baseURL, setBaseURL] = useState(initialSettings?.baseURL ?? initialPreset?.baseURL ?? "");
  const [customId, setCustomId] = useState(initialSettings?.customId ?? "");
  const [imageDetail, setImageDetail] = useState<VisionImageDetail>(
    initialSettings?.imageDetail ?? initialPreset?.imageDetail ?? "none",
  );
  const [imageFormat, setImageFormat] = useState<VisionImageFormat>(
    initialSettings?.imageFormat ?? initialPreset?.imageFormat ?? "data-url",
  );
  const [jsonMode, setJsonMode] = useState(initialSettings?.jsonMode ?? initialPreset?.jsonMode ?? false);
  const [model, setModel] = useState(initialSettings?.model ?? initialPreset?.model ?? "");
  const [showKey, setShowKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function selectProvider(next: ProviderChoice) {
    setChoice(next);
    setError(null);

    const existing = initialSettings?.provider === next ? initialSettings : null;
    const preset = presetFor(next);
    if (next !== "server" && next !== "fixture") {
      setApiKey(existing?.apiKey ?? "");
      setBaseURL(existing?.baseURL ?? preset?.baseURL ?? "");
      setCustomId(existing?.customId ?? "");
      setImageDetail(existing?.imageDetail ?? preset?.imageDetail ?? "none");
      setImageFormat(existing?.imageFormat ?? preset?.imageFormat ?? "data-url");
      setJsonMode(existing?.jsonMode ?? preset?.jsonMode ?? false);
      setModel(existing?.model ?? preset?.model ?? "");
    }
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      if (choice === "server") {
        await onSave(null);
        return;
      }

      const candidate =
        choice === "fixture"
          ? { provider: choice }
          : {
              apiKey,
              baseURL,
              customId: choice === "custom" ? customId : undefined,
              imageDetail,
              imageFormat,
              jsonMode,
              model,
              provider: choice,
            };
      const parsed = UserVisionProviderSchema.safeParse(candidate);
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? "Check the provider settings and try again.");
        return;
      }

      await onSave(parsed.data);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "The provider settings could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  const remote = choice !== "server" && choice !== "fixture";

  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <View style={styles.content}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Close provider settings" hitSlop={8} onPress={onClose} style={styles.iconButton}>
            <ArrowLeft color={colors.text} size={21} strokeWidth={2} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>SETTINGS</Text>
            <Text style={styles.title}>Vision provider</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Provider</Text>
          <View style={styles.providerOptions}>
            {providerChoices.map((option) => {
              const selected = option.id === choice;
              return (
                <Pressable
                  accessibilityLabel={`Use ${option.label}`}
                  accessibilityRole="button"
                  key={option.id}
                  onPress={() => selectProvider(option.id)}
                  style={({ pressed }) => [
                    styles.providerOption,
                    selected && styles.providerOptionSelected,
                    pressed && styles.optionPressed,
                  ]}
                >
                  <Text style={[styles.providerOptionText, selected && styles.providerOptionTextSelected]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {choice === "server" ? (
            <Text style={styles.sectionHint}>
              {serverProvider ? `${serverProvider.id} · ${serverProvider.model}` : "TRACE local default"}
            </Text>
          ) : null}
          {choice === "fixture" ? <Text style={styles.sectionHint}>Deterministic local test responses</Text> : null}
        </View>

        {remote ? (
          <>
            <View style={styles.section}>
              <View style={styles.labelRow}>
                <KeyRound color={colors.primary} size={16} strokeWidth={2} />
                <Text style={styles.sectionLabel}>API key</Text>
              </View>
              <View style={styles.secretInputRow}>
                <TextInput
                  accessibilityLabel="Vision provider API key"
                  autoCapitalize="none"
                  autoCorrect={false}
                  onChangeText={setApiKey}
                  placeholder="Enter your provider key"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry={!showKey}
                  style={[styles.input, styles.secretInput]}
                  value={apiKey}
                />
                <Pressable
                  accessibilityLabel={showKey ? "Hide API key" : "Show API key"}
                  hitSlop={6}
                  onPress={() => setShowKey((visible) => !visible)}
                  style={styles.revealButton}
                >
                  {showKey ? (
                    <EyeOff color={colors.textMuted} size={19} strokeWidth={2} />
                  ) : (
                    <Eye color={colors.textMuted} size={19} strokeWidth={2} />
                  )}
                </Pressable>
              </View>
            </View>

            <View style={styles.fieldGrid}>
              {choice === "custom" ? (
                <LabeledInput
                  accessibilityLabel="Custom provider name"
                  label="Provider name"
                  onChangeText={setCustomId}
                  placeholder="my-provider"
                  value={customId}
                />
              ) : null}
              <LabeledInput
                accessibilityLabel="Vision model"
                label="Model"
                onChangeText={setModel}
                placeholder="Model ID"
                value={model}
              />
              <LabeledInput
                accessibilityLabel="Vision provider base URL"
                label="Base URL"
                onChangeText={setBaseURL}
                placeholder="https://provider.example.com/v1"
                value={baseURL}
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Image payload</Text>
              <View style={styles.inlineOptions}>
                {formatChoices.map((format) => (
                  <OptionButton
                    key={format.id}
                    label={format.label}
                    onPress={() => setImageFormat(format.id)}
                    selected={imageFormat === format.id}
                  />
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Image detail</Text>
              <View style={styles.inlineOptions}>
                {detailChoices.map((detail) => (
                  <OptionButton
                    key={detail}
                    label={detail === "none" ? "Omit" : detail[0]!.toUpperCase() + detail.slice(1)}
                    onPress={() => setImageDetail(detail)}
                    selected={imageDetail === detail}
                  />
                ))}
              </View>
            </View>

            <View style={styles.toggleRow}>
              <View style={styles.toggleCopy}>
                <Text style={styles.sectionLabel}>JSON response mode</Text>
                <Text style={styles.sectionHint}>Enable only when the provider supports OpenAI JSON mode.</Text>
              </View>
              <Switch
                accessibilityLabel="JSON response mode"
                onValueChange={setJsonMode}
                thumbColor="#FFFFFF"
                trackColor={{ false: colors.border, true: colors.primary }}
                value={jsonMode}
              />
            </View>
          </>
        ) : null}

        <View style={styles.securityBand}>
          <ShieldCheck color={colors.blue} size={19} strokeWidth={2} />
          <Text style={styles.securityText}>
            {storage === "keychain"
              ? "Your key is saved only in this device's iOS Keychain."
              : "Your key is saved in this local browser profile. Avoid shared browser profiles."}
          </Text>
        </View>

        {error ? (
          <View accessibilityRole="alert" style={styles.errorBanner}>
            <AlertCircle color={colors.danger} size={18} strokeWidth={2} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => void save()}
          style={({ pressed }) => [styles.saveButton, pressed && styles.saveButtonPressed, busy && styles.disabled]}
        >
          {busy ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Save color="#FFFFFF" size={18} strokeWidth={2.1} />
          )}
          <Text style={styles.saveButtonText}>{busy ? "Saving" : "Save provider"}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

type LabeledInputProps = {
  accessibilityLabel: string;
  label: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  value: string;
};

function LabeledInput({ accessibilityLabel, label, onChangeText, placeholder, value }: LabeledInputProps) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={accessibilityLabel}
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        value={value}
      />
    </View>
  );
}

type OptionButtonProps = {
  label: string;
  onPress: () => void;
  selected: boolean;
};

function OptionButton({ label, onPress, selected }: OptionButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.inlineOption,
        selected && styles.inlineOptionSelected,
        pressed && styles.optionPressed,
      ]}
    >
      <Text style={[styles.inlineOptionText, selected && styles.inlineOptionTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: {
    alignItems: "center",
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 30,
  },
  content: {
    gap: 24,
    maxWidth: 760,
    width: "100%",
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  iconButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 6,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  headerCopy: {
    flex: 1,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "800",
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "700",
    marginTop: 2,
  },
  section: {
    gap: 10,
  },
  sectionLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700",
  },
  sectionHint: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 17,
  },
  providerOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  providerOption: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 6,
    borderWidth: 1,
    flexBasis: 108,
    flexGrow: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 10,
  },
  providerOptionSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  providerOptionText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  providerOptionTextSelected: {
    color: colors.primary,
    fontWeight: "800",
  },
  optionPressed: {
    opacity: 0.72,
  },
  labelRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
  },
  secretInputRow: {
    position: "relative",
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 6,
    borderWidth: 1,
    color: colors.text,
    fontSize: 13,
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  secretInput: {
    paddingRight: 48,
  },
  revealButton: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    position: "absolute",
    right: 1,
    top: 1,
    width: 44,
  },
  fieldGrid: {
    gap: 16,
  },
  inputGroup: {
    gap: 8,
  },
  inlineOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  inlineOption: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 38,
    minWidth: 78,
    paddingHorizontal: 12,
  },
  inlineOptionSelected: {
    backgroundColor: colors.blueSoft,
    borderColor: colors.blue,
  },
  inlineOptionText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "600",
  },
  inlineOptionTextSelected: {
    color: colors.blue,
    fontWeight: "800",
  },
  toggleRow: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderTopColor: colors.border,
    borderBottomWidth: 1,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 18,
    justifyContent: "space-between",
    paddingVertical: 16,
  },
  toggleCopy: {
    flex: 1,
    gap: 4,
  },
  securityBand: {
    alignItems: "flex-start",
    backgroundColor: colors.blueSoft,
    borderColor: "#C7D5EA",
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: "row",
    gap: 9,
    padding: 12,
  },
  securityText: {
    color: colors.blue,
    flex: 1,
    fontSize: 11,
    lineHeight: 17,
  },
  errorBanner: {
    alignItems: "flex-start",
    backgroundColor: colors.dangerSoft,
    borderColor: "#EBC4C4",
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: "row",
    gap: 9,
    padding: 12,
  },
  errorText: {
    color: colors.danger,
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  saveButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 6,
    flexDirection: "row",
    gap: 9,
    justifyContent: "center",
    minHeight: 50,
    paddingHorizontal: 18,
  },
  saveButtonPressed: {
    backgroundColor: colors.primaryPressed,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  disabled: {
    opacity: 0.68,
  },
});
