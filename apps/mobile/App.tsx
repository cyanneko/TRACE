import {
  ActionCardSchema,
  type ActionCard,
  type AnalyzeResult,
  type FixtureId,
  type ProviderInfo,
} from "@trace/contracts";
import { StatusBar } from "expo-status-bar";
import {
  AlertCircle,
  ArrowLeft,
  FileImage,
  ImagePlus,
  RotateCcw,
  Server,
  ShieldCheck,
  Sparkles,
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  type ImageStyle,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

import { analyzeScreenshot, getHealth, TraceApiError } from "./src/api/client";
import { ActionCardView } from "./src/components/ActionCardView";
import { ScenarioSelector } from "./src/components/ScenarioSelector";
import { demoContacts } from "./src/data/demoContacts";
import { pickScreenshot, type SelectedScreenshot } from "./src/lib/pickScreenshot";
import { colors } from "./src/theme";

type Phase = "capture" | "review";

const previewImageStyle: ImageStyle = {
  backgroundColor: "#EEF0ED",
  height: 280,
  width: "100%",
};

const reviewImageStyle: ImageStyle = {
  backgroundColor: colors.surfaceMuted,
  borderRadius: 6,
  height: 260,
  width: "100%",
};

export default function App() {
  const { width } = useWindowDimensions();
  const compact = width < 720;
  const [phase, setPhase] = useState<Phase>("capture");
  const [screenshot, setScreenshot] = useState<SelectedScreenshot | null>(null);
  const [note, setNote] = useState("");
  const [fixtureId, setFixtureId] = useState<FixtureId>("meeting");
  const [provider, setProvider] = useState<ProviderInfo | null>(null);
  const [healthError, setHealthError] = useState(false);
  const [analysis, setAnalysis] = useState<AnalyzeResult | null>(null);
  const [cards, setCards] = useState<ActionCard[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    getHealth()
      .then((health) => {
        if (active) {
          setProvider(health.modelProvider);
          setHealthError(false);
        }
      })
      .catch(() => {
        if (active) {
          setHealthError(true);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  async function chooseScreenshot() {
    setError(null);
    try {
      const selected = await pickScreenshot();
      if (selected) {
        setScreenshot(selected);
      }
    } catch (selectionError) {
      setError(selectionError instanceof Error ? selectionError.message : "Could not open this screenshot.");
    }
  }

  async function analyze() {
    if (!screenshot) {
      setError("Choose a chat screenshot first.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const result = await analyzeScreenshot({
        contacts: demoContacts,
        currentTime: new Date().toISOString(),
        fixtureId: provider?.fixture === false ? undefined : fixtureId,
        memories: [],
        note,
        screenshotDataUrl: screenshot.dataUrl,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      });
      setAnalysis(result);
      setProvider(result.provider);
      setCards(result.actionCards);
      setSelectedIds(new Set(result.actionCards.map((card) => card.id)));
      setPhase("review");
    } catch (analysisError) {
      setError(
        analysisError instanceof TraceApiError
          ? analysisError.message
          : "TRACE could not validate the analysis response. Please retry.",
      );
    } finally {
      setBusy(false);
    }
  }

  function updateCard(nextCard: ActionCard) {
    const validated = ActionCardSchema.safeParse(nextCard);
    setCards((current) => current.map((card) => (card.id === nextCard.id ? nextCard : card)));
    setError(validated.success ? null : "One or more edited fields need attention before confirmation.");
  }

  function toggleCard(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function reset() {
    setAnalysis(null);
    setCards([]);
    setSelectedIds(new Set());
    setError(null);
    setPhase("capture");
  }

  const providerLabel = provider ? `${provider.id} · ${provider.model}` : "Checking API";

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.topBar}>
        <View style={styles.topBarInner}>
          <View style={styles.brandGroup}>
            <View style={styles.brandMark}>
              <Text style={styles.brandMarkText}>T</Text>
            </View>
            <View>
              <Text style={styles.brand}>TRACE</Text>
              {!compact ? <Text style={styles.brandSubline}>Thread intelligence</Text> : null}
            </View>
          </View>
          <View style={[styles.providerStatus, healthError && styles.providerStatusError]}>
            <Server color={healthError ? colors.danger : colors.primary} size={14} strokeWidth={2.2} />
            <Text
              numberOfLines={1}
              style={[styles.providerStatusText, healthError && styles.providerStatusTextError]}
            >
              {healthError ? "API offline" : providerLabel}
            </Text>
          </View>
        </View>
      </View>

      {phase === "capture" ? (
        <CaptureScreen
          busy={busy}
          chooseScreenshot={chooseScreenshot}
          error={error}
          fixtureId={fixtureId}
          fixtureMode={provider?.fixture ?? true}
          note={note}
          onAnalyze={analyze}
          onFixtureChange={setFixtureId}
          onNoteChange={setNote}
          screenshot={screenshot}
        />
      ) : analysis && screenshot ? (
        <ReviewScreen
          analysis={analysis}
          cards={cards}
          compact={compact}
          error={error}
          onBack={reset}
          onCardChange={updateCard}
          onCardToggle={toggleCard}
          screenshot={screenshot}
          selectedIds={selectedIds}
        />
      ) : null}
    </SafeAreaView>
  );
}

type CaptureProps = {
  busy: boolean;
  chooseScreenshot: () => void;
  error: string | null;
  fixtureId: FixtureId;
  fixtureMode: boolean;
  note: string;
  onAnalyze: () => void;
  onFixtureChange: (value: FixtureId) => void;
  onNoteChange: (value: string) => void;
  screenshot: SelectedScreenshot | null;
};

function CaptureScreen({
  busy,
  chooseScreenshot,
  error,
  fixtureId,
  fixtureMode,
  note,
  onAnalyze,
  onFixtureChange,
  onNoteChange,
  screenshot,
}: CaptureProps) {
  return (
    <ScrollView contentContainerStyle={styles.captureScroll} keyboardShouldPersistTaps="handled">
      <View style={styles.captureContent}>
        <View style={styles.headingBlock}>
          <Text style={styles.eyebrow}>NEW THREAD</Text>
          <Text style={styles.heading}>Turn a conversation into clear next steps</Text>
          <Text style={styles.lede}>Add one chat screenshot. TRACE will prepare actions for your review.</Text>
        </View>

        <Pressable
          accessibilityLabel="Choose a chat screenshot"
          onPress={chooseScreenshot}
          style={({ pressed }) => [styles.uploadFrame, pressed && styles.uploadFramePressed]}
        >
          {screenshot ? (
            <>
              <Image
                resizeMode="contain"
                source={{ uri: screenshot.uri }}
                style={previewImageStyle}
              />
              <View style={styles.fileRow}>
                <FileImage color={colors.primary} size={18} strokeWidth={2} />
                <View style={styles.fileCopy}>
                  <Text numberOfLines={1} style={styles.fileName}>
                    {screenshot.fileName}
                  </Text>
                  <Text style={styles.fileMeta}>
                    {screenshot.width} × {screenshot.height}
                  </Text>
                </View>
                <View style={styles.replaceButton}>
                  <RotateCcw color={colors.blue} size={16} strokeWidth={2} />
                  <Text style={styles.replaceText}>Replace</Text>
                </View>
              </View>
            </>
          ) : (
            <View style={styles.uploadEmpty}>
              <View style={styles.uploadIcon}>
                <ImagePlus color={colors.primary} size={27} strokeWidth={1.8} />
              </View>
              <Text style={styles.uploadTitle}>Choose screenshot</Text>
              <Text style={styles.uploadMeta}>PNG, JPEG, GIF or WebP · up to 9 MB</Text>
            </View>
          )}
        </Pressable>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Additional context</Text>
          <TextInput
            maxLength={2_000}
            multiline
            onChangeText={onNoteChange}
            placeholder="Anything the screenshot leaves out?"
            placeholderTextColor={colors.textMuted}
            selectionColor={colors.primary}
            style={styles.noteInput}
            value={note}
          />
          <Text style={styles.characterCount}>{note.length}/2000</Text>
        </View>

        {fixtureMode ? (
          <View style={styles.fixtureBand}>
            <View style={styles.fixtureHeading}>
              <Text style={styles.fixtureTitle}>Fixture mode</Text>
              <Text style={styles.fixtureCopy}>Deterministic API response</Text>
            </View>
            <ScenarioSelector onChange={onFixtureChange} value={fixtureId} />
          </View>
        ) : null}

        {error ? <ErrorBanner message={error} /> : null}

        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={onAnalyze}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.primaryButtonPressed,
            busy && styles.primaryButtonDisabled,
          ]}
        >
          {busy ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Sparkles color="#FFFFFF" size={18} strokeWidth={2.1} />
          )}
          <Text style={styles.primaryButtonText}>{busy ? "Analyzing thread" : "Analyze thread"}</Text>
        </Pressable>

        <View style={styles.privacyRow}>
          <ShieldCheck color={colors.textMuted} size={15} strokeWidth={2} />
          <Text style={styles.privacyText}>No contacts, meetings or memories change during analysis.</Text>
        </View>
      </View>
    </ScrollView>
  );
}

type ReviewProps = {
  analysis: AnalyzeResult;
  cards: ActionCard[];
  compact: boolean;
  error: string | null;
  onBack: () => void;
  onCardChange: (card: ActionCard) => void;
  onCardToggle: (id: string) => void;
  screenshot: SelectedScreenshot;
  selectedIds: Set<string>;
};

function ReviewScreen({
  analysis,
  cards,
  compact,
  error,
  onBack,
  onCardChange,
  onCardToggle,
  screenshot,
  selectedIds,
}: ReviewProps) {
  const evidenceById = useMemo(
    () => new Map(analysis.thread.evidence.map((evidence) => [evidence.id, evidence])),
    [analysis.thread.evidence],
  );

  return (
    <ScrollView contentContainerStyle={styles.reviewScroll} keyboardShouldPersistTaps="handled">
      <View style={styles.reviewContent}>
        <View style={styles.reviewHeader}>
          <Pressable accessibilityLabel="Back to screenshot" hitSlop={8} onPress={onBack} style={styles.backButton}>
            <ArrowLeft color={colors.text} size={21} strokeWidth={2} />
          </Pressable>
          <View style={styles.reviewTitleGroup}>
            <Text style={styles.eyebrow}>REVIEW</Text>
            <Text style={styles.reviewTitle}>Confirm what TRACE understood</Text>
          </View>
          <View style={[styles.modeBadge, !analysis.provider.fixture && styles.liveModeBadge]}>
            <Text style={[styles.modeBadgeText, !analysis.provider.fixture && styles.liveModeBadgeText]}>
              {analysis.provider.fixture ? "Fixture" : "Live model"}
            </Text>
          </View>
        </View>

        <View style={[styles.contextLayout, compact && styles.contextLayoutCompact]}>
          <View style={[styles.screenshotRail, compact && styles.screenshotRailCompact]}>
            <Image
              resizeMode="contain"
              source={{ uri: screenshot.uri }}
              style={reviewImageStyle}
            />
          </View>
          <View style={styles.threadContext}>
            <Text style={styles.sectionLabel}>Thread context</Text>
            <Text style={styles.summary}>{analysis.thread.summary}</Text>
            {analysis.thread.participants.length > 0 ? (
              <View style={styles.participants}>
                {analysis.thread.participants.map((participant) => (
                  <View key={participant.displayName} style={styles.participant}>
                    <Text style={styles.participantName}>{participant.displayName}</Text>
                    <Text style={styles.participantMatch}>
                      {participant.contactId ? "Contact matched" : "Not in contacts"}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
            {analysis.thread.uncertainties.length > 0 ? (
              <View style={styles.uncertainties}>
                <AlertCircle color={colors.orange} size={17} strokeWidth={2} />
                <View style={styles.uncertaintyCopy}>
                  {analysis.thread.uncertainties.map((uncertainty) => (
                    <Text key={uncertainty} style={styles.uncertaintyText}>
                      {uncertainty}
                    </Text>
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.actionsHeading}>
          <View>
            <Text style={styles.sectionLabel}>Proposed actions</Text>
            <Text style={styles.actionsCount}>
              {selectedIds.size} of {cards.length} selected
            </Text>
          </View>
          <Text numberOfLines={1} style={styles.runId}>
            Run {analysis.runId.slice(0, 8)}
          </Text>
        </View>

        {cards.length > 0 ? (
          <View style={styles.cardList}>
            {cards.map((card) => (
              <ActionCardView
                card={card}
                evidence={card.evidenceRefs.flatMap((id) => {
                  const item = evidenceById.get(id);
                  return item ? [item] : [];
                })}
                key={card.id}
                onChange={onCardChange}
                onToggle={() => onCardToggle(card.id)}
                selected={selectedIds.has(card.id)}
              />
            ))}
          </View>
        ) : (
          <View style={styles.noActionState}>
            <ShieldCheck color={colors.primary} size={28} strokeWidth={1.8} />
            <Text style={styles.noActionTitle}>No grounded action found</Text>
            <Text style={styles.noActionCopy}>The conversation does not contain enough detail to create or update anything.</Text>
            <Pressable onPress={onBack} style={styles.secondaryButton}>
              <ArrowLeft color={colors.blue} size={17} strokeWidth={2} />
              <Text style={styles.secondaryButtonText}>Analyze another</Text>
            </Pressable>
          </View>
        )}

        {error ? <ErrorBanner message={error} /> : null}
      </View>
    </ScrollView>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <View accessibilityRole="alert" style={styles.errorBanner}>
      <AlertCircle color={colors.danger} size={18} strokeWidth={2} />
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  topBar: {
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    minHeight: 64,
    paddingHorizontal: 20,
  },
  topBarInner: {
    alignItems: "center",
    alignSelf: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    maxWidth: 1040,
    minHeight: 64,
    width: "100%",
  },
  brandGroup: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  brandMark: {
    alignItems: "center",
    backgroundColor: colors.text,
    borderRadius: 6,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  brandMarkText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
  },
  brand: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  brandSubline: {
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 1,
  },
  providerStatus: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: 12,
    flexDirection: "row",
    gap: 6,
    maxWidth: 260,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  providerStatusError: {
    backgroundColor: colors.dangerSoft,
  },
  providerStatusText: {
    color: colors.primary,
    flexShrink: 1,
    fontSize: 11,
    fontWeight: "700",
  },
  providerStatusTextError: {
    color: colors.danger,
  },
  captureScroll: {
    alignItems: "center",
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 38,
  },
  captureContent: {
    gap: 20,
    maxWidth: 680,
    width: "100%",
  },
  headingBlock: {
    gap: 7,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "800",
  },
  heading: {
    color: colors.text,
    fontSize: 27,
    fontWeight: "700",
    lineHeight: 34,
  },
  lede: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  uploadFrame: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderStyle: "dashed",
    borderWidth: 1,
    minHeight: 240,
    overflow: "hidden",
  },
  uploadFramePressed: {
    borderColor: colors.primary,
    opacity: 0.82,
  },
  uploadEmpty: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    minHeight: 240,
    padding: 28,
  },
  uploadIcon: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: 8,
    height: 52,
    justifyContent: "center",
    marginBottom: 13,
    width: 52,
  },
  uploadTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  uploadMeta: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 5,
  },
  fileRow: {
    alignItems: "center",
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 62,
    paddingHorizontal: 14,
  },
  fileCopy: {
    flex: 1,
    minWidth: 0,
  },
  fileName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
  },
  fileMeta: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  replaceButton: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5,
    minHeight: 36,
  },
  replaceText: {
    color: colors.blue,
    fontSize: 12,
    fontWeight: "700",
  },
  inputGroup: {
    gap: 7,
  },
  inputLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  noteInput: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 6,
    borderWidth: 1,
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    minHeight: 92,
    paddingHorizontal: 13,
    paddingVertical: 11,
    textAlignVertical: "top",
  },
  characterCount: {
    alignSelf: "flex-end",
    color: colors.textMuted,
    fontSize: 10,
  },
  fixtureBand: {
    backgroundColor: colors.blueSoft,
    borderColor: "#C7D5EA",
    borderRadius: 6,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },
  fixtureHeading: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "space-between",
  },
  fixtureTitle: {
    color: colors.blue,
    fontSize: 12,
    fontWeight: "800",
  },
  fixtureCopy: {
    color: colors.textMuted,
    fontSize: 11,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 6,
    flexDirection: "row",
    gap: 9,
    justifyContent: "center",
    minHeight: 50,
    paddingHorizontal: 18,
  },
  primaryButtonPressed: {
    backgroundColor: colors.primaryPressed,
  },
  primaryButtonDisabled: {
    opacity: 0.68,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  privacyRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
    justifyContent: "center",
  },
  privacyText: {
    color: colors.textMuted,
    flexShrink: 1,
    fontSize: 11,
    textAlign: "center",
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
  reviewScroll: {
    alignItems: "center",
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 28,
  },
  reviewContent: {
    gap: 22,
    maxWidth: 960,
    width: "100%",
  },
  reviewHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  backButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 6,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  reviewTitleGroup: {
    flex: 1,
  },
  reviewTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "700",
    marginTop: 2,
  },
  modeBadge: {
    backgroundColor: colors.blueSoft,
    borderRadius: 11,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  liveModeBadge: {
    backgroundColor: colors.primarySoft,
  },
  modeBadgeText: {
    color: colors.blue,
    fontSize: 11,
    fontWeight: "700",
  },
  liveModeBadgeText: {
    color: colors.primary,
  },
  contextLayout: {
    borderBottomColor: colors.border,
    borderTopColor: colors.border,
    borderWidth: 0,
    borderBottomWidth: 1,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 24,
    paddingVertical: 20,
  },
  contextLayoutCompact: {
    flexDirection: "column",
  },
  screenshotRail: {
    flexBasis: 220,
    flexGrow: 0,
    flexShrink: 0,
  },
  screenshotRailCompact: {
    flexBasis: "auto",
  },
  threadContext: {
    flex: 1,
    gap: 12,
    minWidth: 0,
  },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  summary: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "600",
    lineHeight: 25,
  },
  participants: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  participant: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 5,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  participantName: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700",
  },
  participantMatch: {
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
  uncertainties: {
    alignItems: "flex-start",
    backgroundColor: colors.orangeSoft,
    borderRadius: 6,
    flexDirection: "row",
    gap: 8,
    padding: 11,
  },
  uncertaintyCopy: {
    flex: 1,
    gap: 3,
  },
  uncertaintyText: {
    color: colors.orange,
    fontSize: 12,
    lineHeight: 17,
  },
  actionsHeading: {
    alignItems: "flex-end",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  actionsCount: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
    marginTop: 4,
  },
  runId: {
    color: colors.textMuted,
    fontSize: 10,
    maxWidth: 120,
  },
  cardList: {
    gap: 14,
  },
  noActionState: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 30,
  },
  noActionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  noActionCopy: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    maxWidth: 440,
    textAlign: "center",
  },
  secondaryButton: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
    marginTop: 8,
    minHeight: 40,
    paddingHorizontal: 10,
  },
  secondaryButtonText: {
    color: colors.blue,
    fontSize: 13,
    fontWeight: "700",
  },
});
