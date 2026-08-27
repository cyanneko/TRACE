import type { ActionCard, EntityMemory, Insight, InsightBundle, InsightRequest } from "@trace/contracts";

function validEvidenceRefs(input: InsightRequest, action: ActionCard): string[] {
  const available = new Set(input.thread.evidence.map((evidence) => evidence.id));
  const grounded = action.evidenceRefs.filter((id) => available.has(id));
  if (grounded.length > 0) {
    return grounded;
  }

  const fallback = input.thread.evidence[0]?.id;
  return fallback ? [fallback] : [];
}

function contactIdsForAction(input: InsightRequest, action: ActionCard): string[] {
  const ids = new Set<string>();
  if (action.type === "create_meeting") {
    action.payload.participantContactIds.forEach((id) => ids.add(id));
  }
  if (action.type === "update_contact" && action.payload.contactId) {
    ids.add(action.payload.contactId);
  }
  if (action.type === "update_meeting") {
    action.payload.changes.forEach((change) => {
      if (change.field === "participantContactIds") {
        change.nextValue.forEach((id) => ids.add(id));
      }
    });
  }

  const result = input.toolResults.find(
    (candidate) => candidate.success && candidate.actionId === action.id,
  );
  if (result?.entityRef?.type === "contact") {
    ids.add(result.entityRef.id);
    if (result.entityRef.externalId) ids.add(result.entityRef.externalId);
  }
  if ((action.type === "create_contact" || action.type === "update_contact") && result?.externalId) {
    ids.add(result.externalId);
  }
  return [...ids];
}

function meetingIdsForAction(input: InsightRequest, action: ActionCard): string[] {
  const ids = new Set<string>();
  if (action.type === "update_meeting" && action.payload.meetingId) {
    ids.add(action.payload.meetingId);
  }
  const result = input.toolResults.find(
    (candidate) => candidate.success && candidate.actionId === action.id,
  );
  if (result?.entityRef?.type === "meeting") {
    ids.add(result.entityRef.id);
    if (result.entityRef.externalId) ids.add(result.entityRef.externalId);
  }
  return [...ids];
}

function memoriesForAction(input: InsightRequest, action: ActionCard): EntityMemory[] {
  const contactIds = new Set(contactIdsForAction(input, action));
  const meetingIds = new Set(meetingIdsForAction(input, action));
  return input.entityMemories.filter(
    (memory) =>
      memory.status === "active" &&
      (memory.sourceActionId === action.id ||
        (memory.ownerType === "contact" && contactIds.has(memory.ownerId)) ||
        (memory.ownerType === "meeting" && meetingIds.has(memory.ownerId))),
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
    const dedicatedContext = action.memoryProposals.find(
      (proposal) => proposal.target.type === "action_entity",
    )?.content;
    const hasDedicatedContext = Boolean(dedicatedContext);
    return {
      title: hasDedicatedContext ? "会前承诺比日历事件更值得跟进" : "会议已落地，目标仍需对齐",
      body: hasDedicatedContext
        ? `${participants} 不只确认了时间，还留下了专属上下文：“${dedicatedContext}”落实这项信息会直接影响会议质量。`
        : `${participants} 已确认这次会议。当前上下文没有明确准备项，建议在会前补齐目标和预期产出。`,
      importance: "high",
      evidenceRefs,
      memoryRefs,
      nextStep: hasDedicatedContext ? "在会议开始前落实专属上下文中的事项，并在完成后告知对方。" : "发送一句简短确认，补充会议目标。",
      suggestedMessage: hasDedicatedContext
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

  if (action.type === "update_meeting") {
    const changes = action.payload.changes
      .map((change) => {
        const nextValue = Array.isArray(change.nextValue) ? change.nextValue.join("、") : change.nextValue;
        return `${change.field}: ${nextValue ?? "已清空"}`;
      })
      .join("；");
    return {
      title: "会议安排已经变化，相关准备也需要重新对齐",
      body: `${action.payload.displayTitle} 已更新为 ${changes}。建议确认参与人都已看到最新安排。`,
      importance: "high",
      evidenceRefs,
      memoryRefs,
      nextStep: "向参与人发送简短的改期确认，并检查原有提醒是否同步更新。",
      suggestedMessage: `${action.payload.displayTitle} 已按最新安排更新，请以新的会议信息为准。`,
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
  const priorMemories = input.entityMemories.filter(
    (memory) => memory.status === "active" && memory.sourceRunId !== input.sourceRunId,
  );
  const evidenceRef = input.thread.evidence[0]?.id;
  if (priorMemories.length === 0 || !evidenceRef || actions.length === 0) {
    return null;
  }

  const relevantContactIds = new Set(actions.flatMap((action) => contactIdsForAction(input, action)));
  const relevantMeetingIds = new Set(actions.flatMap((action) => meetingIdsForAction(input, action)));
  for (const meeting of input.meetings) {
    if (meeting.participantContactIds.some((contactId) => relevantContactIds.has(contactId))) {
      relevantMeetingIds.add(meeting.id);
      if (meeting.externalEventId) relevantMeetingIds.add(meeting.externalEventId);
    }
  }
  const relevant = priorMemories.filter(
    (memory) =>
      memory.ownerType === "global" ||
      (memory.ownerType === "contact" && relevantContactIds.has(memory.ownerId)) ||
      (memory.ownerType === "meeting" && relevantMeetingIds.has(memory.ownerId)),
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
    globalMemoryOperations: [],
  };
}
