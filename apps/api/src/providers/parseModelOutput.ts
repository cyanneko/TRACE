import {
  AnalyzeModelOutputSchema,
  InsightBundleSchema,
  type AnalyzeModelOutput,
  type InsightBundle,
  type InsightRequest,
} from "@trace/contracts";

export type ModelValidationIssue = {
  message: string;
  path: string;
};

export class ModelOutputError extends Error {
  readonly issues: ModelValidationIssue[];

  constructor(message: string, issues: ModelValidationIssue[] = [], options?: ErrorOptions) {
    super(message, options);
    this.name = "ModelOutputError";
    this.issues = issues;
  }
}

function jsonObjectCandidates(content: string): string[] {
  const trimmed = content.trim();
  const candidates = new Set<string>();
  if (trimmed) candidates.add(trimmed);

  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  if (withoutFence) candidates.add(withoutFence);

  let objectStart = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = 0; index < withoutFence.length; index += 1) {
    const character = withoutFence[index]!;
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') {
      inString = true;
      continue;
    }
    if (character === "{") {
      if (depth === 0) objectStart = index;
      depth += 1;
      continue;
    }
    if (character === "}" && depth > 0) {
      depth -= 1;
      if (depth === 0 && objectStart >= 0) {
        candidates.add(withoutFence.slice(objectStart, index + 1));
        objectStart = -1;
      }
    }
  }

  return [...candidates];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

const isoTimestampWithZone =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/;

function normalizeTimestamp(value: unknown): unknown {
  if (value === "") return null;
  if (typeof value !== "string" || !isoTimestampWithZone.test(value)) return value;
  const timestamp = new Date(value);
  return Number.isFinite(timestamp.getTime()) ? timestamp.toISOString() : value;
}

function normalizeModelOutput(value: unknown): unknown {
  const output = asRecord(value);
  if (!output) return value;

  const thread = asRecord(output.thread);
  if (thread) {
    for (const field of ["participants", "evidence", "uncertainties"] as const) {
      if (thread[field] === null) thread[field] = [];
    }
    if (Array.isArray(thread.participants)) {
      for (const participantValue of thread.participants) {
        const participant = asRecord(participantValue);
        if (participant && (participant.contactId === null || participant.contactId === "")) {
          delete participant.contactId;
        }
        if (participant?.isSelf === null) participant.isSelf = false;
      }
    }
  }
  if (!Array.isArray(output.actionCards)) return value;

  for (const actionValue of output.actionCards) {
    const action = asRecord(actionValue);
    const payload = asRecord(action?.payload);
    if (!action || !payload) continue;

    for (const field of ["editableFields", "riskFlags", "memoryProposals"] as const) {
      if (action[field] === null) action[field] = [];
    }

    if (action.type === "create_meeting") {
      payload.startAt = normalizeTimestamp(payload.startAt);
      payload.endAt = normalizeTimestamp(payload.endAt);
      if (payload.participantContactIds === null) payload.participantContactIds = [];
      if (payload.participantNames === null) payload.participantNames = [];
      if (payload.notes === null) payload.notes = "";
    }

    if (action.type === "create_contact") {
      for (const field of [
        "givenName",
        "familyName",
        "company",
        "jobTitle",
        "notes",
        "interactionSummary",
      ] as const) {
        if (payload[field] === null) payload[field] = "";
      }
      for (const field of ["phones", "emails"] as const) {
        if (payload[field] === null) payload[field] = [];
        if (Array.isArray(payload[field])) {
          payload[field] = payload[field].flatMap((item) => {
            const normalized = typeof item === "string" ? item.trim() : "";
            return normalized ? [normalized] : [];
          });
        }
      }
      if (payload.isSelf === null) payload.isSelf = false;
    }

    if (action.type === "update_meeting") {
      if (payload.participantNames === null) payload.participantNames = [];
      if (Array.isArray(payload.changes)) {
        for (const changeValue of payload.changes) {
          const change = asRecord(changeValue);
          if (change?.field === "startAt" || change?.field === "endAt") {
            change.previousValue = normalizeTimestamp(change.previousValue);
            change.nextValue = normalizeTimestamp(change.nextValue);
          }
        }
      }
    }
  }
  return value;
}

function normalizeInsightOutput(value: unknown): unknown {
  const output = asRecord(value);
  if (!output) return value;

  for (const field of ["insights", "unresolvedQuestions", "globalMemoryOperations"] as const) {
    if (output[field] === null) output[field] = [];
  }
  if (Array.isArray(output.insights)) {
    for (const insightValue of output.insights) {
      const insight = asRecord(insightValue);
      if (insight?.memoryRefs === null) insight.memoryRefs = [];
    }
  }
  return output;
}

function validationIssues(error: { issues: Array<{ message: string; path: PropertyKey[] }> }) {
  return error.issues.slice(0, 12).map((issue) => ({
    message: issue.message,
    path: issue.path.length > 0 ? issue.path.map(String).join(".") : "$",
  }));
}

function parse(content: string) {
  let lastError: unknown = new SyntaxError("Response is not valid JSON.");
  let issues: ModelValidationIssue[] = [{ message: "Response is not valid JSON.", path: "$" }];

  for (const candidate of jsonObjectCandidates(content)) {
    let value: unknown;
    try {
      value = JSON.parse(candidate);
    } catch (error) {
      lastError = error;
      continue;
    }

    const parsed = AnalyzeModelOutputSchema.safeParse(normalizeModelOutput(value));
    if (parsed.success) return parsed;
    lastError = parsed.error;
    issues = validationIssues(parsed.error);
  }

  return { success: false as const, error: lastError, issues };
}

function insightReferenceIssues(input: InsightRequest, bundle: InsightBundle): ModelValidationIssue[] {
  const issues: ModelValidationIssue[] = [];
  const evidenceIds = new Set(input.thread.evidence.map((evidence) => evidence.id));
  const activeMemories = input.entityMemories.filter((memory) => memory.status === "active");
  const memoryIds = new Set(activeMemories.map((memory) => memory.id));
  const globalMemoryIds = new Set(
    activeMemories
      .filter((memory) => memory.ownerType === "global")
      .map((memory) => memory.id),
  );

  bundle.insights.forEach((insight, insightIndex) => {
    insight.evidenceRefs.forEach((reference, referenceIndex) => {
      if (!evidenceIds.has(reference)) {
        issues.push({
          message: `Unknown thread evidence ID ${reference}.`,
          path: `insights.${insightIndex}.evidenceRefs.${referenceIndex}`,
        });
      }
    });
    insight.memoryRefs.forEach((reference, referenceIndex) => {
      if (!memoryIds.has(reference)) {
        issues.push({
          message: `Unknown active entity memory ID ${reference}.`,
          path: `insights.${insightIndex}.memoryRefs.${referenceIndex}`,
        });
      }
    });
  });

  bundle.globalMemoryOperations.forEach((operation, operationIndex) => {
    operation.evidenceRefs.forEach((reference, referenceIndex) => {
      if (!evidenceIds.has(reference)) {
        issues.push({
          message: `Unknown thread evidence ID ${reference}.`,
          path: `globalMemoryOperations.${operationIndex}.evidenceRefs.${referenceIndex}`,
        });
      }
    });
    if (operation.type !== "create" && !globalMemoryIds.has(operation.memoryId)) {
      issues.push({
        message: `Memory ${operation.memoryId} is not an active global memory.`,
        path: `globalMemoryOperations.${operationIndex}.memoryId`,
      });
    }
  });

  return issues.slice(0, 12);
}

function parseInsight(content: string, input: InsightRequest) {
  let lastError: unknown = new SyntaxError("Response is not valid JSON.");
  let issues: ModelValidationIssue[] = [{ message: "Response is not valid JSON.", path: "$" }];

  for (const candidate of jsonObjectCandidates(content)) {
    let value: unknown;
    try {
      value = JSON.parse(candidate);
    } catch (error) {
      lastError = error;
      continue;
    }

    const parsed = InsightBundleSchema.safeParse(normalizeInsightOutput(value));
    if (!parsed.success) {
      lastError = parsed.error;
      issues = validationIssues(parsed.error);
      continue;
    }
    const referenceIssues = insightReferenceIssues(input, parsed.data);
    if (referenceIssues.length === 0) return parsed;
    lastError = new Error("Insight response contains references outside the supplied context.");
    issues = referenceIssues;
  }

  return { success: false as const, error: lastError, issues };
}

type ParseWithRepairInput = {
  initial: () => Promise<string>;
  repair: (invalidOutput: string, issues: ModelValidationIssue[]) => Promise<string>;
};

export async function parseAnalyzeOutputWithRepair({
  initial,
  repair,
}: ParseWithRepairInput): Promise<AnalyzeModelOutput> {
  const firstOutput = await initial();
  const firstParse = parse(firstOutput);
  if (firstParse.success) {
    return firstParse.data;
  }

  const repairedOutput = await repair(firstOutput, firstParse.issues);
  const repairedParse = parse(repairedOutput);
  if (repairedParse.success) {
    return repairedParse.data;
  }

  throw new ModelOutputError(
    "Model returned invalid structured output after one repair attempt",
    repairedParse.issues,
    { cause: repairedParse.error },
  );
}

type ParseInsightWithRepairInput = ParseWithRepairInput & {
  input: InsightRequest;
};

export async function parseInsightOutputWithRepair({
  input,
  initial,
  repair,
}: ParseInsightWithRepairInput): Promise<InsightBundle> {
  const firstOutput = await initial();
  const firstParse = parseInsight(firstOutput, input);
  if (firstParse.success) {
    return firstParse.data;
  }

  const repairedOutput = await repair(firstOutput, firstParse.issues);
  const repairedParse = parseInsight(repairedOutput, input);
  if (repairedParse.success) {
    return repairedParse.data;
  }

  throw new ModelOutputError(
    "Model returned invalid structured insight output after one repair attempt",
    repairedParse.issues,
    { cause: repairedParse.error },
  );
}
