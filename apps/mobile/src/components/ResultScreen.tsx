import type { AnalyzeResult } from "@trace/contracts";
import * as Clipboard from "expo-clipboard";
import {
  ArrowLeft,
  CalendarCheck2,
  Check,
  CheckCircle2,
  CircleAlert,
  Copy,
  Database,
  Lightbulb,
  MessageSquareText,
  RefreshCw,
  Trash2,
  UserCheck,
} from "lucide-react-native";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import type { ExecutionState } from "../execution/reducer";
import { memoryDetail, memoryTitle } from "../memory/presentation";
import { colors } from "../theme";

type Props = {
  analysis: AnalyzeResult;
  execution: ExecutionState;
  executionMode: "demo" | "native";
  onDeleteMemory: (memoryId: string) => Promise<void>;
  onNewThread: () => void;
  onRetryInsights: () => void;
};

function actionLabel(type: string): string {
  if (type === "create_meeting") {
    return "Calendar event";
  }
  if (type === "create_contact") {
    return "New contact";
  }
  return "Contact update";
}

export function ResultScreen({
  analysis,
  execution,
  executionMode,
  onDeleteMemory,
  onNewThread,
  onRetryInsights,
}: Props) {
  const [copiedInsight, setCopiedInsight] = useState<number | null>(null);
  const evidenceById = useMemo(
    () => new Map(analysis.thread.evidence.map((evidence) => [evidence.id, evidence])),
    [analysis.thread.evidence],
  );
  const actionById = useMemo(
    () => new Map(analysis.actionCards.map((action) => [action.id, action])),
    [analysis.actionCards],
  );
  const writtenIds = new Set(execution.writtenMemoryIds);

  async function copyMessage(index: number, message: string) {
    await Clipboard.setStringAsync(message);
    setCopiedInsight(index);
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <View style={styles.content}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Analyze another thread" hitSlop={8} onPress={onNewThread} style={styles.backButton}>
            <ArrowLeft color={colors.text} size={21} strokeWidth={2} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>EXECUTION</Text>
            <Text style={styles.title}>Actions confirmed</Text>
            <Text style={styles.lede}>
              TRACE used successful {executionMode === "demo" ? "Demo" : "device"} writes to update context before generating help.
            </Text>
          </View>
          <View style={styles.demoBadge}>
            <Text style={styles.demoBadgeText}>{executionMode === "demo" ? "Demo writes" : "Device writes"}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <View>
              <Text style={styles.sectionLabel}>Execution results</Text>
              <Text style={styles.sectionTitle}>
                {execution.results.filter((result) => result.success).length} of {execution.results.length} succeeded
              </Text>
            </View>
            <CheckCircle2 color={colors.primary} size={23} strokeWidth={2} />
          </View>
          <View style={styles.resultList}>
            {execution.results.map((result) => {
              const action = actionById.get(result.actionId);
              const Icon = action?.type === "create_meeting" ? CalendarCheck2 : UserCheck;
              return (
                <View key={result.actionId} style={styles.resultRow}>
                  <View style={[styles.resultIcon, !result.success && styles.resultIconFailed]}>
                    <Icon color={result.success ? colors.primary : colors.danger} size={18} strokeWidth={2} />
                  </View>
                  <View style={styles.resultCopy}>
                    <Text style={styles.resultTitle}>{action ? actionLabel(action.type) : result.actionId}</Text>
                    <Text numberOfLines={1} style={styles.resultMeta}>
                      {result.success ? result.externalId ?? "Completed" : result.error ?? "Failed"}
                    </Text>
                  </View>
                  <View style={[styles.status, !result.success && styles.statusFailed]}>
                    <Text style={[styles.statusText, !result.success && styles.statusTextFailed]}>
                      {result.success ? "Written" : "Failed"}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <View>
              <Text style={styles.sectionLabel}>Memory</Text>
              <Text style={styles.sectionTitle}>{execution.activeMemories.length} active facts and open loops</Text>
            </View>
            <Database color={colors.blue} size={22} strokeWidth={2} />
          </View>
          {execution.activeMemories.length > 0 ? (
            <View style={styles.memoryList}>
              {execution.activeMemories.slice(0, 8).map((memory) => (
                <View key={memory.id} style={styles.memoryRow}>
                  <View style={styles.memoryCopy}>
                    <View style={styles.memoryTitleRow}>
                      <Text numberOfLines={2} style={styles.memoryTitle}>
                        {memoryTitle(memory)}
                      </Text>
                      {writtenIds.has(memory.id) ? <Text style={styles.newMemory}>New</Text> : null}
                    </View>
                    <Text style={styles.memoryType}>{memory.type.replaceAll("_", " ")}</Text>
                    <Text style={styles.memoryDetail}>{memoryDetail(memory)}</Text>
                  </View>
                  <Pressable
                    accessibilityLabel={`Delete memory ${memoryTitle(memory)}`}
                    hitSlop={8}
                    onPress={() => void onDeleteMemory(memory.id)}
                    style={styles.deleteButton}
                  >
                    <Trash2 color={colors.textMuted} size={18} strokeWidth={1.9} />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyCopy}>No successful action produced a durable memory.</Text>
          )}
          {execution.supersededMemoryIds.length > 0 ? (
            <Text style={styles.auditCopy}>
              {execution.supersededMemoryIds.length} older memory record(s) were superseded and kept in the audit trail.
            </Text>
          ) : null}
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <View>
              <Text style={styles.sectionLabel}>Agent insights</Text>
              <Text style={styles.sectionTitle}>What helps after the write</Text>
            </View>
            {execution.status === "insighting" ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <Lightbulb color={colors.orange} size={23} strokeWidth={2} />
            )}
          </View>

          {execution.status === "insighting" ? (
            <View style={styles.loadingBand}>
              <Text style={styles.loadingTitle}>Connecting actions, evidence and memory</Text>
              <Text style={styles.loadingCopy}>The writes are already complete. TRACE is preparing grounded follow-up help.</Text>
            </View>
          ) : null}

          {execution.insights ? (
            <View style={styles.insightList}>
              {execution.insights.insights.map((insight, index) => (
                <View key={`${insight.title}-${index}`} style={styles.insightCard}>
                  <View style={styles.insightHeading}>
                    <View style={styles.importanceMark} />
                    <Text style={styles.insightTitle}>{insight.title}</Text>
                    <Text style={styles.importance}>{insight.importance}</Text>
                  </View>
                  <Text style={styles.insightBody}>{insight.body}</Text>
                  {insight.nextStep ? (
                    <View style={styles.nextStep}>
                      <Check color={colors.primary} size={17} strokeWidth={2.2} />
                      <Text style={styles.nextStepText}>{insight.nextStep}</Text>
                    </View>
                  ) : null}
                  <View style={styles.sources}>
                    <Text style={styles.sourcesLabel}>Grounding</Text>
                    {insight.evidenceRefs.map((id) => {
                      const evidence = evidenceById.get(id);
                      return evidence ? (
                        <Text key={id} style={styles.sourceText}>
                          “{evidence.quote}”
                        </Text>
                      ) : null;
                    })}
                    {insight.memoryRefs.length > 0 ? (
                      <Text style={styles.memoryRefs}>{insight.memoryRefs.length} active memory reference(s)</Text>
                    ) : null}
                  </View>
                  {insight.suggestedMessage ? (
                    <View style={styles.messageBlock}>
                      <View style={styles.messageHeading}>
                        <MessageSquareText color={colors.blue} size={17} strokeWidth={2} />
                        <Text style={styles.messageLabel}>Suggested message</Text>
                        <Pressable
                          accessibilityLabel="Copy suggested message"
                          hitSlop={8}
                          onPress={() => void copyMessage(index, insight.suggestedMessage!)}
                          style={styles.copyButton}
                        >
                          {copiedInsight === index ? (
                            <Check color={colors.primary} size={17} strokeWidth={2.2} />
                          ) : (
                            <Copy color={colors.blue} size={17} strokeWidth={2} />
                          )}
                        </Pressable>
                      </View>
                      <Text selectable style={styles.messageText}>
                        {insight.suggestedMessage}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ))}
              {execution.insights.unresolvedQuestions.length > 0 ? (
                <View style={styles.questions}>
                  <CircleAlert color={colors.orange} size={18} strokeWidth={2} />
                  <View style={styles.questionCopy}>
                    {execution.insights.unresolvedQuestions.map((question) => (
                      <Text key={question} style={styles.questionText}>
                        {question}
                      </Text>
                    ))}
                  </View>
                </View>
              ) : null}
            </View>
          ) : null}

          {execution.error ? (
            <View accessibilityRole="alert" style={styles.errorBand}>
              <CircleAlert color={colors.danger} size={18} strokeWidth={2} />
              <View style={styles.errorCopy}>
                <Text style={styles.errorTitle}>Insights could not finish</Text>
                <Text style={styles.errorText}>{execution.error}</Text>
              </View>
              <Pressable accessibilityLabel="Retry insights" onPress={onRetryInsights} style={styles.retryButton}>
                <RefreshCw color={colors.danger} size={17} strokeWidth={2} />
              </Pressable>
            </View>
          ) : null}
        </View>

        <Pressable accessibilityRole="button" onPress={onNewThread} style={styles.primaryButton}>
          <ArrowLeft color="#FFFFFF" size={18} strokeWidth={2} />
          <Text style={styles.primaryButtonText}>Analyze another thread</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 28,
  },
  content: {
    gap: 24,
    maxWidth: 960,
    width: "100%",
  },
  header: {
    alignItems: "flex-start",
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
  headerCopy: {
    flex: 1,
    minWidth: 0,
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
  lede: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5,
  },
  demoBadge: {
    backgroundColor: colors.blueSoft,
    borderRadius: 11,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  demoBadgeText: {
    color: colors.blue,
    fontSize: 11,
    fontWeight: "700",
  },
  section: {
    gap: 15,
  },
  sectionHeading: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    marginTop: 4,
  },
  resultList: {
    borderBottomColor: colors.border,
    borderTopColor: colors.border,
    borderTopWidth: 1,
  },
  resultRow: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 11,
    minHeight: 68,
    paddingVertical: 10,
  },
  resultIcon: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: 6,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  resultIconFailed: {
    backgroundColor: colors.dangerSoft,
  },
  resultCopy: {
    flex: 1,
    minWidth: 0,
  },
  resultTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  resultMeta: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 3,
  },
  status: {
    backgroundColor: colors.primarySoft,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusFailed: {
    backgroundColor: colors.dangerSoft,
  },
  statusText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "700",
  },
  statusTextFailed: {
    color: colors.danger,
  },
  divider: {
    backgroundColor: colors.border,
    height: 1,
  },
  memoryList: {
    gap: 8,
  },
  memoryRow: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 7,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 13,
  },
  memoryCopy: {
    flex: 1,
    minWidth: 0,
  },
  memoryTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
  },
  memoryTitle: {
    color: colors.text,
    flexShrink: 1,
    fontSize: 14,
    fontWeight: "700",
  },
  newMemory: {
    backgroundColor: colors.primarySoft,
    borderRadius: 9,
    color: colors.primary,
    fontSize: 10,
    fontWeight: "700",
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  memoryType: {
    color: colors.blue,
    fontSize: 10,
    fontWeight: "700",
    marginTop: 4,
    textTransform: "uppercase",
  },
  memoryDetail: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  deleteButton: {
    alignItems: "center",
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  emptyCopy: {
    color: colors.textMuted,
    fontSize: 13,
  },
  auditCopy: {
    color: colors.textMuted,
    fontSize: 11,
  },
  loadingBand: {
    borderLeftColor: colors.primary,
    borderLeftWidth: 3,
    paddingLeft: 13,
  },
  loadingTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  loadingCopy: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  insightList: {
    gap: 12,
  },
  insightCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 13,
    padding: 17,
  },
  insightHeading: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  importanceMark: {
    backgroundColor: colors.orange,
    borderRadius: 2,
    height: 18,
    width: 3,
  },
  insightTitle: {
    color: colors.text,
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22,
  },
  importance: {
    color: colors.orange,
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  insightBody: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 21,
  },
  nextStep: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 8,
  },
  nextStepText: {
    color: colors.text,
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  sources: {
    borderLeftColor: colors.blue,
    borderLeftWidth: 2,
    gap: 5,
    paddingLeft: 11,
  },
  sourcesLabel: {
    color: colors.blue,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  sourceText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  memoryRefs: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "600",
  },
  messageBlock: {
    backgroundColor: colors.blueSoft,
    borderLeftColor: colors.blue,
    borderLeftWidth: 3,
    gap: 8,
    padding: 12,
  },
  messageHeading: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
  },
  messageLabel: {
    color: colors.blue,
    flex: 1,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  copyButton: {
    alignItems: "center",
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  messageText: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 19,
  },
  questions: {
    alignItems: "flex-start",
    backgroundColor: colors.orangeSoft,
    borderRadius: 7,
    flexDirection: "row",
    gap: 9,
    padding: 12,
  },
  questionCopy: {
    flex: 1,
    gap: 4,
  },
  questionText: {
    color: colors.orange,
    fontSize: 12,
    lineHeight: 17,
  },
  errorBand: {
    alignItems: "center",
    backgroundColor: colors.dangerSoft,
    borderRadius: 7,
    flexDirection: "row",
    gap: 10,
    padding: 12,
  },
  errorCopy: {
    flex: 1,
  },
  errorTitle: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "700",
  },
  errorText: {
    color: colors.danger,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  retryButton: {
    alignItems: "center",
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 7,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 50,
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
