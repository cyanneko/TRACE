import {
  ActionCardSchema,
  type ActionCard,
  type AnalyzeResult,
  type ContactRecord,
  type ContactSummary,
  type EntityMemory,
  type FixtureId,
  type MemoryEntry,
  type MeetingRecord,
  type ProviderInfo,
  type ToolResult,
  type UserVisionProvider,
} from "@trace/contracts";
import { StatusBar } from "expo-status-bar";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Cpu,
  RotateCcw,
  Settings,
  ShieldCheck,
  Sparkles,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
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

import { analyzeScreenshot, generateInsights, getHealth, TraceApiError } from "./src/api/client";
import { ActionCardView } from "./src/components/ActionCardView";
import { BottomNavigation, type MainTab } from "./src/components/BottomNavigation";
import { ContactsScreen } from "./src/components/ContactsScreen";
import { MeetingsScreen } from "./src/components/MeetingsScreen";
import { ProviderSettingsScreen } from "./src/components/ProviderSettingsScreen";
import { ResultScreen } from "./src/components/ResultScreen";
import { ScenarioSelector } from "./src/components/ScenarioSelector";
import { DemoContactSource } from "./src/contacts/demoContactSource";
import { mergeContactContext, mergeMeetingContext } from "./src/entities/analysisContext";
import { DemoActionExecutor } from "./src/execution/demoActionExecutor";
import { executeAndCommit } from "./src/execution/executeAndCommit";
import { executionReducer, initialExecutionState } from "./src/execution/reducer";
import { pickScreenshot, type SelectedScreenshot } from "./src/lib/pickScreenshot";
import { deriveMemoryCandidates } from "./src/memory/policy";
import { DemoMeetingSource } from "./src/meetings/demoMeetingSource";
import { createPlatformServices } from "./src/platform/services";
import { describeUserVisionProvider } from "./src/providerSettings/model";
import {
  createProviderSettingsRepository,
  providerSettingsStorage,
} from "./src/providerSettings/repository";
import { colors } from "./src/theme";

type Phase = "capture" | "review" | "result";

const previewImageStyle: ImageStyle = {
  backgroundColor: "#EEF0ED",
  height: 260,
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
  const [activeTab, setActiveTab] = useState<MainTab>("analyze");
  const [phase, setPhase] = useState<Phase>("capture");
  const [screenshot, setScreenshot] = useState<SelectedScreenshot | null>(null);
  const [note, setNote] = useState("");
  const [fixtureId, setFixtureId] = useState<FixtureId>("meeting");
  const [provider, setProvider] = useState<ProviderInfo | null>(null);
  const [serverProvider, setServerProvider] = useState<ProviderInfo | null>(null);
  const [userVisionProvider, setUserVisionProvider] = useState<UserVisionProvider | null>(null);
  const userVisionProviderRef = useRef<UserVisionProvider | null>(null);
  const settingsRevisionRef = useRef(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [healthError, setHealthError] = useState(false);
  const [analysis, setAnalysis] = useState<AnalyzeResult | null>(null);
  const [analysisContacts, setAnalysisContacts] = useState<ContactSummary[]>([]);
  const [cards, setCards] = useState<ActionCard[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeMemories, setActiveMemories] = useState<MemoryEntry[]>([]);
  const [entityContacts, setEntityContacts] = useState<ContactRecord[]>([]);
  const [entityMeetings, setEntityMeetings] = useState<MeetingRecord[]>([]);
  const [entityMemories, setEntityMemories] = useState<EntityMemory[]>([]);
  const [entityLoading, setEntityLoading] = useState(true);
  const [entityError, setEntityError] = useState<string | null>(null);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [execution, dispatchExecution] = useReducer(executionReducer, initialExecutionState);
  const platformServices = useMemo(() => createPlatformServices(), []);
  const providerSettingsRepository = useMemo(() => createProviderSettingsRepository(), []);
  const fixtureContactSource = useMemo(() => new DemoContactSource(), []);
  const fixtureMeetingSource = useMemo(() => new DemoMeetingSource(), []);
  const fixtureActionExecutor = useMemo(() => new DemoActionExecutor(), []);
  const actionExecutor = platformServices.executor;
  const entityRepository = platformServices.entities;
  const memoryRepository = platformServices.memories;

  const refreshEntities = useCallback(async () => {
    setEntityLoading(true);
    setEntityError(null);
    try {
      await entityRepository.initialize();
      const [contacts, meetings, memories] = await Promise.all([
        entityRepository.listContacts(),
        entityRepository.listMeetings(),
        entityRepository.listAllMemories(),
      ]);
      setEntityContacts(contacts);
      setEntityMeetings(meetings);
      setEntityMemories(memories);
    } catch (loadError) {
      setEntityError(
        loadError instanceof Error ? loadError.message : "Saved contacts and meetings could not be opened.",
      );
    } finally {
      setEntityLoading(false);
    }
  }, [entityRepository]);

  useEffect(() => {
    let active = true;
    const settingsRevision = settingsRevisionRef.current;

    void providerSettingsRepository
      .load()
      .then((settings) => {
        if (settingsRevisionRef.current !== settingsRevision) {
          return;
        }
        userVisionProviderRef.current = settings;
        if (active) {
          setUserVisionProvider(settings);
          if (settings) {
            setProvider(describeUserVisionProvider(settings, null));
          }
        }
      })
      .catch(() => {
        if (active) {
          setError("Saved provider settings could not be opened.");
        }
      });

    void getHealth()
      .then((health) => {
        if (active) {
          setServerProvider(health.modelProvider);
          setProvider(describeUserVisionProvider(userVisionProviderRef.current, health.modelProvider));
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
  }, [providerSettingsRepository]);

  useEffect(() => {
    let active = true;
    setActiveMemories([]);

    void memoryRepository
      .listActive()
      .then((memories) => {
        if (active) {
          setActiveMemories(memories);
        }
      })
      .catch(() => {
        if (active) {
          setError("Saved memories could not be opened.");
        }
      });

    return () => {
      active = false;
    };
  }, [memoryRepository]);

  useEffect(() => {
    void refreshEntities();
  }, [refreshEntities]);

  useEffect(() => {
    if (activeTab === "analyze") {
      return;
    }

    let active = true;
    const source = platformServices.capabilities.contacts === "native" ? "ios" : "demo";
    setEntityLoading(true);
    setEntityError(null);

    void (async () => {
      try {
        if (activeTab === "contacts") {
          const contacts = await platformServices.contacts.list();
          if (!active) return;
          await entityRepository.syncContacts(contacts, source);
        } else {
          const currentTime = new Date().toISOString();
          const [contacts, meetings] = await Promise.all([
            platformServices.contacts.list(),
            platformServices.meetings.list(currentTime),
          ]);
          if (!active) return;
          await entityRepository.syncContacts(contacts, source);
          await entityRepository.syncMeetings(meetings, source);
        }
        if (active) await refreshEntities();
      } catch (syncError) {
        if (active) {
          setEntityError(
            syncError instanceof Error ? syncError.message : "Contacts and meetings could not be synchronized.",
          );
          setEntityLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [activeTab, entityRepository, platformServices, refreshEntities]);

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
      const currentTime = new Date().toISOString();
      const useFixture = provider?.fixture ?? true;
      const [memories, sourceContacts, sourceMeetings] = await Promise.all([
        memoryRepository.listActive(),
        useFixture ? fixtureContactSource.list() : platformServices.contacts.list(),
        (useFixture ? fixtureMeetingSource : platformServices.meetings).list(currentTime),
      ]);
      const entitySource = useFixture
        ? "demo"
        : platformServices.capabilities.contacts === "native"
          ? "ios"
          : "demo";
      await entityRepository.syncContacts(sourceContacts, entitySource);
      await entityRepository.syncMeetings(sourceMeetings, entitySource);
      const [localContacts, localMeetings, currentEntityMemories] = await Promise.all([
        entityRepository.listContacts(),
        entityRepository.listMeetings(),
        entityRepository.listAllMemories(),
      ]);
      const contacts = mergeContactContext(sourceContacts, localContacts);
      const meetings = mergeMeetingContext(sourceMeetings, localMeetings);
      const result = await analyzeScreenshot({
        contacts,
        currentTime,
        entityMemories: currentEntityMemories,
        fixtureId: provider?.fixture === false ? undefined : fixtureId,
        meetings,
        memories,
        note,
        screenshotDataUrl: screenshot.dataUrl,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        visionProvider: userVisionProvider ?? undefined,
      });
      setAnalysis(result);
      setAnalysisContacts(contacts);
      setActiveMemories(memories);
      setEntityContacts(localContacts);
      setEntityMeetings(localMeetings);
      setEntityMemories(currentEntityMemories);
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

  function timezone() {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  }

  async function requestInsights(
    currentAnalysis: AnalyzeResult,
    confirmedActions: ActionCard[],
    results: ToolResult[],
    activeMemories: MemoryEntry[],
  ) {
    const insightResult = await generateInsights({
      sourceRunId: currentAnalysis.runId,
      thread: currentAnalysis.thread,
      confirmedActions,
      toolResults: results,
      memories: activeMemories,
      contacts: analysisContacts,
      timezone: timezone(),
      currentTime: new Date().toISOString(),
    });
    dispatchExecution({ type: "INSIGHTS_READY", insights: insightResult });
  }

  async function confirmSelectedActions() {
    if (!analysis) {
      return;
    }

    const selectedCards = cards.filter((card) => selectedIds.has(card.id));
    const validatedCards = selectedCards.map((card) => ActionCardSchema.safeParse(card));
    if (selectedCards.length === 0) {
      setError("Select at least one action to continue.");
      return;
    }
    if (validatedCards.some((result) => !result.success)) {
      setError("One or more edited fields need attention before confirmation.");
      return;
    }

    setError(null);
    dispatchExecution({ type: "START" });
    const confirmedActions = validatedCards.flatMap((result) => (result.success ? [result.data] : []));
    const results: ToolResult[] = [];

    try {
      const executor = analysis.provider.fixture ? fixtureActionExecutor : actionExecutor;
      for (const action of confirmedActions) {
        results.push(await executeAndCommit(analysis.runId, action, executor, entityRepository, timezone()));
      }

      const now = new Date().toISOString();
      const candidates = deriveMemoryCandidates({
        sourceRunId: analysis.runId,
        actions: confirmedActions,
        results,
        now,
      });
      const merged = await memoryRepository.apply(candidates);
      const activeMemories = merged.entries.filter((memory) => memory.status === "active");
      dispatchExecution({
        type: "EXECUTED",
        results,
        activeMemories,
        writtenMemoryIds: merged.writtenMemoryIds,
        supersededMemoryIds: merged.supersededMemoryIds,
      });
      setActiveMemories(activeMemories);
      await refreshEntities();
      setPhase("result");

      try {
        await requestInsights(analysis, confirmedActions, results, activeMemories);
      } catch (insightError) {
        dispatchExecution({
          type: "FAILED",
          error: insightError instanceof Error ? insightError.message : "Insight generation failed. Please retry.",
        });
      }
    } catch (executionError) {
      dispatchExecution({
        type: "FAILED",
        error: executionError instanceof Error ? executionError.message : "The selected actions could not be executed.",
      });
      setError("The selected actions could not be executed. No new memory was written.");
    }
  }

  async function retryInsights() {
    if (!analysis || execution.results.length === 0) {
      return;
    }

    const resultIds = new Set(execution.results.map((result) => result.actionId));
    const confirmedActions = cards.filter((card) => resultIds.has(card.id));
    dispatchExecution({ type: "INSIGHTS_START" });
    try {
      await requestInsights(analysis, confirmedActions, execution.results, execution.activeMemories);
    } catch (insightError) {
      dispatchExecution({
        type: "FAILED",
        error: insightError instanceof Error ? insightError.message : "Insight generation failed. Please retry.",
      });
    }
  }

  function reportEntityError(entityActionError: unknown, fallback: string) {
    setEntityError(entityActionError instanceof Error ? entityActionError.message : fallback);
  }

  async function createContact() {
    setEntityError(null);
    try {
      const contact = await entityRepository.createContactDraft();
      await refreshEntities();
      setSelectedContactId(contact.id);
    } catch (createError) {
      reportEntityError(createError, "The contact could not be created.");
    }
  }

  async function saveContact(contact: ContactRecord) {
    setEntityError(null);
    try {
      if (contact.isSelf) {
        const updatedAt = new Date().toISOString();
        for (const existing of entityContacts) {
          if (existing.id !== contact.id && existing.isSelf) {
            await entityRepository.saveContact({
              ...existing,
              isSelf: false,
              source: "trace",
              updatedAt,
            });
          }
        }
      }
      await entityRepository.saveContact({ ...contact, source: "trace" });
      await refreshEntities();
    } catch (saveError) {
      reportEntityError(saveError, "The contact could not be saved. Check its email and required fields.");
    }
  }

  async function deleteContact(contactId: string) {
    setEntityError(null);
    try {
      await entityRepository.deleteContact(contactId);
      await refreshEntities();
    } catch (deleteError) {
      reportEntityError(deleteError, "The contact could not be deleted.");
    }
  }

  async function createMeeting() {
    setEntityError(null);
    try {
      const meeting = await entityRepository.createMeetingDraft(timezone());
      await refreshEntities();
      setSelectedMeetingId(meeting.id);
    } catch (createError) {
      reportEntityError(createError, "The meeting could not be created.");
    }
  }

  async function saveMeeting(meeting: MeetingRecord) {
    setEntityError(null);
    try {
      await entityRepository.saveMeeting({
        ...meeting,
        participantContactIds: [...new Set(meeting.participantContactIds)],
        source: "trace",
      });
      await refreshEntities();
    } catch (saveError) {
      reportEntityError(saveError, "The meeting could not be saved. Check its dates and required fields.");
    }
  }

  async function deleteMeeting(meetingId: string) {
    setEntityError(null);
    try {
      await entityRepository.deleteMeeting(meetingId);
      await refreshEntities();
    } catch (deleteError) {
      reportEntityError(deleteError, "The meeting could not be deleted.");
    }
  }

  async function addMeetingParticipant(meetingId: string, contactId: string) {
    setEntityError(null);
    try {
      const meeting = await entityRepository.findMeeting(meetingId);
      const contact = await entityRepository.findContact(contactId);
      if (!meeting || !contact) throw new Error("The meeting or contact no longer exists.");
      if (meeting.participantContactIds.includes(contact.id)) return;
      await entityRepository.saveMeeting({
        ...meeting,
        participantContactIds: [...meeting.participantContactIds, contact.id],
        source: "trace",
        updatedAt: new Date().toISOString(),
      });
      await refreshEntities();
    } catch (participantError) {
      reportEntityError(participantError, "The participant could not be added.");
    }
  }

  async function removeMeetingParticipant(meetingId: string, contactId: string) {
    setEntityError(null);
    try {
      const meeting = await entityRepository.findMeeting(meetingId);
      if (!meeting) throw new Error("The meeting no longer exists.");
      await entityRepository.saveMeeting({
        ...meeting,
        participantContactIds: meeting.participantContactIds.filter((id) => id !== contactId),
        source: "trace",
        updatedAt: new Date().toISOString(),
      });
      await refreshEntities();
    } catch (participantError) {
      reportEntityError(participantError, "The participant could not be removed.");
    }
  }

  async function createMeetingParticipant(meetingId: string) {
    setEntityError(null);
    try {
      const contact = await entityRepository.createContactDraft();
      const meeting = await entityRepository.findMeeting(meetingId);
      if (!meeting) throw new Error("The meeting no longer exists.");
      await entityRepository.saveMeeting({
        ...meeting,
        participantContactIds: [...new Set([...meeting.participantContactIds, contact.id])],
        source: "trace",
        updatedAt: new Date().toISOString(),
      });
      await refreshEntities();
      setSelectedContactId(contact.id);
      setActiveTab("contacts");
    } catch (participantError) {
      reportEntityError(participantError, "A new participant could not be created.");
    }
  }

  function openContact(contactId: string) {
    const contact = entityContacts.find(
      (candidate) => candidate.id === contactId || candidate.externalContactId === contactId,
    );
    if (!contact) {
      setEntityError("This participant is not linked to a saved contact.");
      return;
    }
    setSelectedContactId(contact.id);
    setActiveTab("contacts");
  }

  async function addEntityMemory(
    ownerType: EntityMemory["ownerType"],
    ownerId: string,
    kind: EntityMemory["kind"],
    content: string,
  ) {
    setEntityError(null);
    try {
      await entityRepository.addMemory({ ownerType, ownerId, kind, content });
      await refreshEntities();
    } catch (memoryError) {
      reportEntityError(memoryError, "The memory could not be added.");
    }
  }

  async function updateEntityMemory(memoryId: string, kind: EntityMemory["kind"], content: string) {
    setEntityError(null);
    try {
      await entityRepository.updateMemory(memoryId, { kind, content });
      await refreshEntities();
    } catch (memoryError) {
      reportEntityError(memoryError, "The memory could not be updated.");
    }
  }

  async function deleteEntityMemory(memoryId: string) {
    setEntityError(null);
    try {
      await entityRepository.deleteMemory(memoryId);
      await refreshEntities();
    } catch (memoryError) {
      reportEntityError(memoryError, "The memory could not be deleted.");
    }
  }

  function reset() {
    setAnalysis(null);
    setAnalysisContacts([]);
    setCards([]);
    setSelectedIds(new Set());
    setError(null);
    dispatchExecution({ type: "RESET" });
    setPhase("capture");
  }

  function startNewThread() {
    reset();
    setScreenshot(null);
    setNote("");
  }

  async function saveProviderSettings(settings: UserVisionProvider | null) {
    settingsRevisionRef.current += 1;
    if (settings) {
      await providerSettingsRepository.save(settings);
    } else {
      await providerSettingsRepository.clear();
    }
    userVisionProviderRef.current = settings;
    setUserVisionProvider(settings);
    setProvider(describeUserVisionProvider(settings, serverProvider));
    reset();
    setSettingsOpen(false);
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
          <View style={styles.topBarActions}>
            <View
              style={[
                styles.providerStatus,
                compact && styles.providerStatusCompact,
                healthError && styles.providerStatusError,
              ]}
            >
              <Cpu color={healthError ? colors.danger : colors.primary} size={14} strokeWidth={2.2} />
              <Text
                numberOfLines={1}
                style={[styles.providerStatusText, healthError && styles.providerStatusTextError]}
              >
                {healthError ? "Analyzer offline" : providerLabel}
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Provider settings"
              hitSlop={6}
              onPress={() => setSettingsOpen(true)}
              style={({ pressed }) => [styles.settingsButton, pressed && styles.settingsButtonPressed]}
            >
              <Settings color={colors.text} size={19} strokeWidth={2} />
            </Pressable>
          </View>
        </View>
      </View>

      <View style={styles.mainContent}>
        {settingsOpen ? (
          <ProviderSettingsScreen
            initialSettings={userVisionProvider}
            onClose={() => setSettingsOpen(false)}
            onSave={saveProviderSettings}
            serverProvider={serverProvider}
            storage={providerSettingsStorage}
          />
        ) : activeTab === "meetings" ? (
          <MeetingsScreen
            contacts={entityContacts}
            error={entityError}
            loading={entityLoading}
            meetings={entityMeetings}
            memories={entityMemories}
            onAddMemory={(meetingId, kind, content) =>
              addEntityMemory("meeting", meetingId, kind, content)
            }
            onAddParticipant={addMeetingParticipant}
            onCreate={createMeeting}
            onCreateParticipant={createMeetingParticipant}
            onDelete={deleteMeeting}
            onDeleteMemory={deleteEntityMemory}
            onOpenContact={openContact}
            onRemoveParticipant={removeMeetingParticipant}
            onSave={saveMeeting}
            onSelect={(meetingId) => {
              setEntityError(null);
              setSelectedMeetingId(meetingId);
            }}
            onUpdateMemory={updateEntityMemory}
            selectedMeetingId={selectedMeetingId}
          />
        ) : activeTab === "contacts" ? (
          <ContactsScreen
            contacts={entityContacts}
            error={entityError}
            loading={entityLoading}
            memories={entityMemories}
            onAddMemory={(contactId, kind, content) =>
              addEntityMemory("contact", contactId, kind, content)
            }
            onCreate={createContact}
            onDelete={deleteContact}
            onDeleteMemory={deleteEntityMemory}
            onSave={saveContact}
            onSelect={(contactId) => {
              setEntityError(null);
              setSelectedContactId(contactId);
            }}
            onUpdateMemory={updateEntityMemory}
            selectedContactId={selectedContactId}
          />
        ) : phase === "capture" ? (
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
        ) : phase === "review" && analysis && screenshot ? (
          <ReviewScreen
            analysis={analysis}
            cards={cards}
            compact={compact}
            error={error}
            onBack={reset}
            onCardChange={updateCard}
            onCardToggle={toggleCard}
            onConfirm={() => void confirmSelectedActions()}
            confirming={execution.status === "running"}
            executionMode={analysis.provider.fixture ? "demo" : platformServices.capabilities.actions}
            screenshot={screenshot}
            selectedIds={selectedIds}
          />
        ) : phase === "result" && analysis ? (
          <ResultScreen
            analysis={analysis}
            execution={execution}
            executionMode={analysis.provider.fixture ? "demo" : platformServices.capabilities.actions}
            onNewThread={startNewThread}
            onRetryInsights={() => void retryInsights()}
          />
        ) : null}
      </View>

      {!settingsOpen ? (
        <BottomNavigation
          activeTab={activeTab}
          contactCount={entityContacts.length}
          meetingCount={entityMeetings.length}
          onChange={setActiveTab}
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
        <Text style={styles.captureTitle}>New thread</Text>

        <Pressable
          accessibilityLabel={screenshot ? "Replace chat screenshot" : "Choose a chat screenshot"}
          onPress={chooseScreenshot}
          style={({ pressed }) => [
            styles.uploadFrame,
            screenshot && styles.uploadFrameSelected,
            pressed && styles.uploadFramePressed,
          ]}
        >
          {screenshot ? (
            <>
              <Image resizeMode="contain" source={{ uri: screenshot.uri }} style={previewImageStyle} />
              <View style={styles.replaceAffordance}>
                <RotateCcw color={colors.blue} size={19} strokeWidth={2} />
              </View>
            </>
          ) : (
            <View style={styles.uploadEmpty}>
              <Text style={styles.uploadTitle}>Choose screenshot</Text>
            </View>
          )}
        </Pressable>

        {error ? <ErrorBanner message={error} /> : null}

        {screenshot ? (
          <>
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
                <Sparkles color="#FFFFFF" size={20} strokeWidth={2.1} />
              )}
              <Text style={styles.primaryButtonText}>{busy ? "Analyzing thread" : "Analyze thread"}</Text>
            </Pressable>

            <View style={styles.privacyRow}>
              <ShieldCheck color={colors.textMuted} size={16} strokeWidth={2} />
              <Text style={styles.privacyText}>No contacts, meetings or memories change during analysis.</Text>
            </View>
          </>
        ) : null}
      </View>
    </ScrollView>
  );
}

type ReviewProps = {
  analysis: AnalyzeResult;
  cards: ActionCard[];
  compact: boolean;
  error: string | null;
  executionMode: "demo" | "native";
  confirming: boolean;
  onBack: () => void;
  onCardChange: (card: ActionCard) => void;
  onCardToggle: (id: string) => void;
  onConfirm: () => void;
  screenshot: SelectedScreenshot;
  selectedIds: Set<string>;
};

function ReviewScreen({
  analysis,
  cards,
  compact,
  confirming,
  error,
  executionMode,
  onBack,
  onCardChange,
  onCardToggle,
  onConfirm,
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

        {cards.length > 0 ? (
          <View style={styles.confirmationBoundary}>
            <View style={styles.confirmationCopy}>
              <Text style={styles.confirmationTitle}>Confirmation is the write boundary</Text>
              <Text style={styles.confirmationDetail}>
                {selectedIds.size} selected action(s) will be written by the {executionMode === "demo" ? "Demo" : "iOS"} executor.
                Unselected cards stay untouched.
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              disabled={confirming || selectedIds.size === 0}
              onPress={onConfirm}
              style={({ pressed }) => [
                styles.confirmButton,
                pressed && styles.primaryButtonPressed,
                (confirming || selectedIds.size === 0) && styles.primaryButtonDisabled,
              ]}
            >
              {confirming ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <CheckCircle2 color="#FFFFFF" size={18} strokeWidth={2.1} />
              )}
              <Text style={styles.confirmButtonText}>{confirming ? "Executing" : "Confirm and execute"}</Text>
            </Pressable>
          </View>
        ) : null}
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
  mainContent: {
    flex: 1,
    minHeight: 0,
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
    fontSize: 18,
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
  providerStatusCompact: {
    maxWidth: 148,
  },
  providerStatusError: {
    backgroundColor: colors.dangerSoft,
  },
  providerStatusText: {
    color: colors.primary,
    flexShrink: 1,
    fontSize: 12,
    fontWeight: "700",
  },
  providerStatusTextError: {
    color: colors.danger,
  },
  topBarActions: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "flex-end",
    minWidth: 0,
  },
  settingsButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 6,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  settingsButtonPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  captureScroll: {
    alignItems: "center",
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  captureContent: {
    gap: 20,
    maxWidth: 680,
    width: "100%",
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
  },
  captureTitle: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 34,
  },
  uploadFrame: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderStyle: "dashed",
    borderWidth: 1,
    minHeight: 168,
    overflow: "hidden",
  },
  uploadFrameSelected: {
    borderStyle: "solid",
    minHeight: 0,
  },
  uploadFramePressed: {
    borderColor: colors.primary,
    opacity: 0.82,
  },
  uploadEmpty: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    minHeight: 168,
    padding: 24,
  },
  uploadTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: "700",
    lineHeight: 25,
  },
  replaceAffordance: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.94)",
    borderColor: colors.border,
    borderRadius: 6,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    position: "absolute",
    right: 12,
    top: 12,
    width: 40,
  },
  inputGroup: {
    gap: 7,
  },
  inputLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  noteInput: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 6,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    lineHeight: 23,
    minHeight: 108,
    paddingHorizontal: 14,
    paddingVertical: 13,
    textAlignVertical: "top",
  },
  characterCount: {
    alignSelf: "flex-end",
    color: colors.textMuted,
    fontSize: 12,
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
    fontSize: 14,
    fontWeight: "800",
  },
  fixtureCopy: {
    color: colors.textMuted,
    fontSize: 12,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 6,
    flexDirection: "row",
    gap: 9,
    justifyContent: "center",
    minHeight: 54,
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
    fontSize: 16,
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
    fontSize: 12,
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
    fontSize: 14,
    lineHeight: 20,
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
  confirmationBoundary: {
    alignItems: "center",
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    justifyContent: "space-between",
    paddingTop: 18,
  },
  confirmationCopy: {
    flex: 1,
    minWidth: 240,
  },
  confirmationTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  confirmationDetail: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 3,
  },
  confirmButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 7,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 46,
    minWidth: 190,
    paddingHorizontal: 17,
  },
  confirmButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
});
