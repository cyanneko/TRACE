import type { ActionCard, Insight, InsightBundle, InsightRequest, MemoryEntry } from "@trace/contracts";

function validEvidenceRefs(input: InsightRequest, action: ActionCard): string[] {
  const available = new Set(input.thread.evidence.map((evidence) => evidence.id));
  const grounded = action.evidenceRefs.filter((id) => available.has(id));
  if (grounded.length > 0) {
    return grounded;
  }

  const fallback = input.thread.evidence[0]?.id;
  return fallback ? [fallback] : [];
}

function memoriesForAction(input: InsightRequest, action: ActionCard): MemoryEntry[] {
  return input.memories.filter(
    (memory) =>
      memory.status === "active" &&
      (memory.sourceActionId === action.id ||
        (action.type === "update_contact" && memory.contactId === action.payload.contactId) ||
        (action.type === "create_meeting" && action.payload.participantContactIds.includes(memory.contactId ?? ""))),
  );
}

function actionInsight(input: InsightRequest, action: ActionCard): Insight | null {
  const evidenceRefs = validEvidenceRefs(input, action);
  if (evidenceRefs.length === 0) {
    return null;
  }

  const memoryRefs = memoriesForAction(input, action).map((memory) => memory.id);

  if (action.type === "create_meeting") {
    const participants = action.payload.participantNames.join("、") || "对方";
    const hasPreparation = action.payload.notes.trim().length > 0;
    return {
      title: hasPreparation ? "会前承诺比日历事件更值得跟进" : "会议已落地，目标仍需对齐",
      body: hasPreparation
        ? `${participants} 不只确认了时间，还留下了会前事项：“${action.payload.notes}”完成这项承诺会直接影响会议质量。`
        : `${participants} 已确认这次会议。当前上下文没有明确准备项，建议在会前补齐目标和预期产出。`,
      importance: "high",
      evidenceRefs,
      memoryRefs,
      nextStep: hasPreparation ? "在会议开始前完成备注中的准备事项，并在完成后告知对方。" : "发送一句简短确认，补充会议目标。",
      suggestedMessage: hasPreparation
        ? `${participants}，时间已经记下了。我会按约在会前准备好相关材料，到时见。`
        : `${participants}，时间已经记下了。为了让讨论更聚焦，我们会前再对齐一下目标。`,
    };
  }

  if (action.type === "create_contact") {
    const company = action.payload.company ? `（${action.payload.company}）` : "";
    return {
      title: "新联系人已经建立，但下一次互动还没有落点",
      body: `${action.payload.displayName}${company} 已进入联系人数据。对话表达了继续沟通的意愿，但当前线程没有形成明确时间。`,
      importance: "medium",
      evidenceRefs,
      memoryRefs,
      nextStep: "用一个具体日期把模糊的后续意向变成可执行安排。",
      suggestedMessage: `${action.payload.displayName}，很高兴认识你。我们下周找个具体时间继续聊，周二或周三哪天更方便？`,
    };
  }

  const changes = action.payload.changes.map((change) => `${change.field}: ${change.nextValue}`).join("；");
  return {
    title: "联系人变化可能意味着沟通语境也变了",
    body: `${action.payload.displayName} 的资料已更新为 ${changes}。后续沟通可以围绕新职责重新校准关注点，避免沿用旧角色假设。`,
    importance: "medium",
    evidenceRefs,
    memoryRefs,
    nextStep: "下一次联系时询问她当前最优先推进的目标。",
    suggestedMessage: `${action.payload.displayName}，恭喜新的变化。你现在最希望优先推进的事情是什么？之后交流时我也好更贴近你的重点。`,
  };
}

function continuityInsight(input: InsightRequest, actions: ActionCard[]): Insight | null {
  const priorMemories = input.memories.filter(
    (memory) => memory.status === "active" && memory.sourceRunId !== input.sourceRunId,
  );
  const evidenceRef = input.thread.evidence[0]?.id;
  if (priorMemories.length === 0 || !evidenceRef || actions.length === 0) {
    return null;
  }

  const relevantContactIds = new Set(
    actions.flatMap((action) => {
      if (action.type === "create_meeting") {
        return action.payload.participantContactIds;
      }
      if (action.type === "update_contact") {
        return action.payload.contactId ? [action.payload.contactId] : [];
      }
      return [];
    }),
  );
  const relevant = priorMemories.filter(
    (memory) => !memory.contactId || relevantContactIds.size === 0 || relevantContactIds.has(memory.contactId),
  );
  if (relevant.length === 0) {
    return null;
  }

  return {
    title: "这条线程延续了之前的上下文",
    body: `TRACE 找到 ${relevant.length} 条仍有效的历史记忆，并把它们与当前对话一起考虑。建议先处理尚未关闭的承诺，再开启新的跟进。`,
    importance: "medium",
    evidenceRefs: [evidenceRef],
    memoryRefs: relevant.slice(0, 5).map((memory) => memory.id),
    nextStep: "检查历史 open loop 是否已经完成；完成后可从 memory 中删除。",
  };
}

export function buildGroundedInsights(input: InsightRequest): InsightBundle {
  const successfulIds = new Set(
    input.toolResults.filter((result) => result.success).map((result) => result.actionId),
  );
  const successfulActions = input.confirmedActions.filter((action) => successfulIds.has(action.id));
  const insights = successfulActions
    .map((action) => actionInsight(input, action))
    .filter((insight): insight is Insight => insight !== null);
  const continuity = continuityInsight(input, successfulActions);
  if (continuity) {
    insights.push(continuity);
  }

  const unresolvedQuestions = successfulActions.flatMap((action) => {
    if (action.type === "create_meeting" && (!action.payload.startAt || !action.payload.endAt)) {
      return ["会议的开始或结束时间仍不完整。"];
    }
    if (action.type === "create_contact" && action.payload.phones.length === 0) {
      return ["是否需要补充这个联系人的电话号码？"];
    }
    return [];
  });

  if (successfulActions.length === 0 && input.confirmedActions.length > 0) {
    unresolvedQuestions.push("已确认的操作没有成功执行，因此没有生成新的事实或建议。");
  }

  return {
    insights: insights.slice(0, 3),
    unresolvedQuestions,
  };
}
