import { z } from "zod";

const ConfidenceSchema = z.number().min(0).max(1);
const NonEmptyStringSchema = z.string().trim().min(1);

export const EvidenceSchema = z.object({
  id: NonEmptyStringSchema,
  quote: NonEmptyStringSchema,
  speaker: z.string().trim().optional(),
  timestampText: z.string().trim().optional(),
});

export const ThreadParticipantSchema = z.object({
  displayName: NonEmptyStringSchema,
  contactId: z.string().trim().optional(),
  confidence: ConfidenceSchema,
});

export const ThreadContextSchema = z.object({
  summary: NonEmptyStringSchema,
  participants: z.array(ThreadParticipantSchema),
  evidence: z.array(EvidenceSchema),
  uncertainties: z.array(NonEmptyStringSchema),
});

export const MemoryProposalTargetSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("action_entity") }),
  z.object({ type: z.literal("contact"), contactId: NonEmptyStringSchema }),
  z.object({ type: z.literal("meeting"), meetingId: NonEmptyStringSchema }),
]);

export const MemoryProposalSchema = z.object({
  target: MemoryProposalTargetSchema,
  kind: z.enum(["context", "preference", "commitment", "note"]),
  content: NonEmptyStringSchema,
  evidenceRefs: z.array(NonEmptyStringSchema).min(1),
});

const ActionCardBaseSchema = z.object({
  id: NonEmptyStringSchema,
  title: NonEmptyStringSchema,
  confidence: ConfidenceSchema,
  evidenceRefs: z.array(NonEmptyStringSchema),
  editableFields: z.array(NonEmptyStringSchema),
  riskFlags: z.array(NonEmptyStringSchema),
  memoryProposals: z.array(MemoryProposalSchema).default([]),
});

export const CreateMeetingCardSchema = ActionCardBaseSchema.extend({
  type: z.literal("create_meeting"),
  payload: z.object({
    title: NonEmptyStringSchema,
    startAt: z.iso.datetime().nullable(),
    endAt: z.iso.datetime().nullable(),
    timezone: NonEmptyStringSchema,
    participantContactIds: z.array(NonEmptyStringSchema),
    participantNames: z.array(NonEmptyStringSchema),
    notes: z.string(),
  }),
});

export const CreateContactCardSchema = ActionCardBaseSchema.extend({
  type: z.literal("create_contact"),
  payload: z.object({
    displayName: NonEmptyStringSchema,
    givenName: z.string(),
    familyName: z.string(),
    company: z.string(),
    jobTitle: z.string(),
    phones: z.array(NonEmptyStringSchema),
    emails: z.array(z.email()),
    notes: z.string(),
    isSelf: z.boolean().default(false),
    interactionSummary: z.string().default(""),
  }),
});

export const ContactChangeSchema = z.object({
  field: z.enum(["displayName", "givenName", "familyName", "company", "jobTitle", "phone", "email", "notes"]),
  previousValue: z.string().nullable(),
  nextValue: NonEmptyStringSchema,
});

export const UpdateContactCardSchema = ActionCardBaseSchema.extend({
  type: z.literal("update_contact"),
  payload: z.object({
    contactId: z.string().trim().nullable(),
    displayName: NonEmptyStringSchema,
    changes: z.array(ContactChangeSchema).min(1),
  }),
});

const MeetingTextChangeSchema = z
  .object({
    field: z.enum(["title", "timezone", "location", "meetingLink", "notes"]),
    previousValue: z.string().nullable(),
    nextValue: z.string().nullable(),
  })
  .superRefine((change, context) => {
    if ((change.field === "title" || change.field === "timezone") && !change.nextValue?.trim()) {
      context.addIssue({
        code: "custom",
        message: `${change.field} cannot be empty.`,
        path: ["nextValue"],
      });
    }
  });

const MeetingTimeChangeSchema = z.object({
  field: z.enum(["startAt", "endAt"]),
  previousValue: z.iso.datetime().nullable(),
  nextValue: z.iso.datetime().nullable(),
});

const MeetingParticipantsChangeSchema = z.object({
  field: z.literal("participantContactIds"),
  previousValue: z.array(NonEmptyStringSchema),
  nextValue: z.array(NonEmptyStringSchema),
});

export const MeetingChangeSchema = z.discriminatedUnion("field", [
  MeetingTextChangeSchema,
  MeetingTimeChangeSchema,
  MeetingParticipantsChangeSchema,
]);

export const UpdateMeetingCardSchema = ActionCardBaseSchema.extend({
  type: z.literal("update_meeting"),
  payload: z.object({
    meetingId: z.string().trim().nullable(),
    displayTitle: NonEmptyStringSchema,
    changes: z.array(MeetingChangeSchema).min(1),
  }),
});

export const ActionCardSchema = z.discriminatedUnion("type", [
  CreateMeetingCardSchema,
  UpdateMeetingCardSchema,
  CreateContactCardSchema,
  UpdateContactCardSchema,
]);

export const ProviderInfoSchema = z.object({
  id: NonEmptyStringSchema,
  model: NonEmptyStringSchema,
  fixture: z.boolean(),
});

export const VisionProviderIdSchema = z.enum(["fixture", "deepseek", "glm", "doubao", "custom"]);
export const VisionImageDetailSchema = z.enum(["auto", "high", "low", "none"]);
export const VisionImageFormatSchema = z.enum(["data-url", "base64"]);

const OptionalProviderStringSchema = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().trim().min(1).max(8_192).optional(),
);

const OptionalProviderUrlSchema = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.url().max(2_048).optional(),
);

export const UserVisionProviderSchema = z
  .object({
    provider: VisionProviderIdSchema,
    apiKey: OptionalProviderStringSchema,
    baseURL: OptionalProviderUrlSchema,
    customId: OptionalProviderStringSchema,
    imageDetail: VisionImageDetailSchema.optional(),
    imageFormat: VisionImageFormatSchema.optional(),
    jsonMode: z.boolean().optional(),
    model: OptionalProviderStringSchema,
  })
  .superRefine((settings, context) => {
    if (settings.provider !== "fixture" && !settings.apiKey) {
      context.addIssue({
        code: "custom",
        message: "An API key is required for a remote vision provider.",
        path: ["apiKey"],
      });
    }

    if (settings.provider === "custom") {
      if (!settings.baseURL) {
        context.addIssue({
          code: "custom",
          message: "A base URL is required for a custom provider.",
          path: ["baseURL"],
        });
      }
      if (!settings.model) {
        context.addIssue({
          code: "custom",
          message: "A model is required for a custom provider.",
          path: ["model"],
        });
      }
    }
  });

export const AnalyzeResultSchema = z.object({
  runId: z.uuid(),
  provider: ProviderInfoSchema,
  thread: ThreadContextSchema,
  actionCards: z.array(ActionCardSchema),
});

export const AnalyzeModelOutputSchema = AnalyzeResultSchema.omit({
  provider: true,
  runId: true,
});

export const ContactSummarySchema = z.object({
  id: NonEmptyStringSchema,
  displayName: NonEmptyStringSchema,
  company: z.string(),
  jobTitle: z.string(),
  phones: z.array(z.string()),
  emails: z.array(z.string()),
});

export const ContactRecordSchema = z
  .object({
    id: z.uuid(),
    externalContactId: z.string().trim().optional(),
    displayName: z.string().trim().max(500),
    sortName: z.string().trim().max(500).optional(),
    givenName: z.string().trim().max(500).optional(),
    familyName: z.string().trim().max(500).optional(),
    company: z.string().trim().max(500).optional(),
    jobTitle: z.string().trim().max(500).optional(),
    phones: z.array(NonEmptyStringSchema),
    emails: z.array(z.email()),
    isSelf: z.boolean(),
    status: z.enum(["draft", "active"]),
    source: z.enum(["ios", "trace", "demo"]),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .superRefine((contact, context) => {
    if (contact.status === "active" && !contact.displayName) {
      context.addIssue({
        code: "custom",
        message: "An active contact requires a display name.",
        path: ["displayName"],
      });
    }
  });

export const MeetingRecordSchema = z
  .object({
    id: z.uuid(),
    externalEventId: z.string().trim().optional(),
    title: z.string().trim().max(500),
    startAt: z.iso.datetime().optional(),
    endAt: z.iso.datetime().optional(),
    timezone: z.string().trim().max(100),
    allDay: z.boolean(),
    location: z.string().trim().max(2_000).optional(),
    meetingLink: z.string().trim().max(2_048).optional(),
    notes: z.string().max(10_000).optional(),
    participantContactIds: z.array(NonEmptyStringSchema),
    status: z.enum(["draft", "active"]),
    source: z.enum(["ios", "trace", "demo"]),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .superRefine((meeting, context) => {
    if (meeting.status === "active" && !meeting.title) {
      context.addIssue({
        code: "custom",
        message: "An active meeting requires a title.",
        path: ["title"],
      });
    }
    if (meeting.status === "active" && !meeting.timezone) {
      context.addIssue({
        code: "custom",
        message: "An active meeting requires a timezone.",
        path: ["timezone"],
      });
    }
  });

export const MeetingStateSchema = z.enum(["ongoing", "upcoming", "ended", "time_unresolved"]);

export const EntityMemorySchema = z.object({
  id: z.uuid(),
  ownerType: z.enum(["contact", "meeting"]),
  ownerId: z.uuid(),
  kind: z.enum(["context", "preference", "commitment", "note"]),
  content: NonEmptyStringSchema,
  status: z.enum(["active", "deleted"]),
  source: z.enum(["action", "manual", "migration"]),
  sourceRunId: z.uuid().optional(),
  sourceActionId: z.string().trim().optional(),
  sourceEvidenceRefs: z.array(z.string()),
  confidence: ConfidenceSchema.optional(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const FixtureIdSchema = z.enum([
  "meeting",
  "update-meeting",
  "new-contact",
  "update-contact",
  "many-actions",
  "no-action",
]);

export const AnalyzeRequestSchema = z.object({
  screenshotDataUrl: z
    .string()
    .max(12 * 1024 * 1024)
    .regex(/^data:image\/(jpeg|png|gif|webp);base64,[A-Za-z0-9+/=\r\n]+$/),
  note: z.string().trim().max(2_000).default(""),
  contacts: z.array(ContactSummarySchema).max(200).default([]),
  memories: z.array(z.lazy(() => MemoryEntrySchema)).max(50).default([]),
  timezone: z.string().trim().min(1).max(100),
  currentTime: z.iso.datetime(),
  fixtureId: FixtureIdSchema.optional(),
  visionProvider: UserVisionProviderSchema.optional(),
});

export const ToolResultSchema = z.object({
  actionId: NonEmptyStringSchema,
  success: z.boolean(),
  provider: z.enum(["native", "demo"]),
  externalId: z.string().optional(),
  entityRef: z
    .object({
      type: z.enum(["contact", "meeting"]),
      id: z.uuid(),
      externalId: z.string().optional(),
    })
    .optional(),
  error: z.string().optional(),
});

export const ActionExecutionRecordSchema = z.object({
  idempotencyKey: NonEmptyStringSchema,
  sourceRunId: z.uuid(),
  action: ActionCardSchema,
  result: ToolResultSchema,
  executedAt: z.iso.datetime(),
});

export const MemoryEntrySchema = z.object({
  id: z.uuid(),
  contactId: z.string().optional(),
  type: z.enum(["contact_fact", "preference", "open_loop", "relationship_fact"]),
  key: NonEmptyStringSchema,
  value: z.unknown(),
  status: z.enum(["candidate", "active", "superseded", "deleted"]),
  sourceRunId: z.uuid(),
  sourceActionId: z.string().optional(),
  sourceEvidenceRefs: z.array(z.string()),
  confidence: ConfidenceSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const InsightSchema = z.object({
  title: NonEmptyStringSchema,
  body: NonEmptyStringSchema,
  importance: z.enum(["high", "medium", "low"]),
  evidenceRefs: z.array(NonEmptyStringSchema).min(1),
  memoryRefs: z.array(z.uuid()).default([]),
  nextStep: z.string().optional(),
  suggestedMessage: z.string().optional(),
});

export const InsightBundleSchema = z.object({
  insights: z.array(InsightSchema).max(3),
  unresolvedQuestions: z.array(NonEmptyStringSchema),
});

export const InsightRequestSchema = z
  .object({
    sourceRunId: z.uuid(),
    thread: ThreadContextSchema,
    confirmedActions: z.array(ActionCardSchema),
    toolResults: z.array(ToolResultSchema),
    memories: z.array(MemoryEntrySchema).max(100),
    contacts: z.array(ContactSummarySchema).max(200).default([]),
    timezone: z.string().trim().min(1).max(100),
    currentTime: z.iso.datetime(),
  })
  .superRefine((input, context) => {
    const confirmedIds = new Set(input.confirmedActions.map((action) => action.id));
    const resultIds = new Set(input.toolResults.map((result) => result.actionId));

    for (const resultId of resultIds) {
      if (!confirmedIds.has(resultId)) {
        context.addIssue({
          code: "custom",
          message: `Tool result ${resultId} does not match a confirmed action.`,
          path: ["toolResults"],
        });
      }
    }
  });

export const InsightResultSchema = InsightBundleSchema.extend({
  sourceRunId: z.uuid(),
  generatedAt: z.iso.datetime(),
  provider: ProviderInfoSchema,
});

export type Evidence = z.infer<typeof EvidenceSchema>;
export type ThreadParticipant = z.infer<typeof ThreadParticipantSchema>;
export type ThreadContext = z.infer<typeof ThreadContextSchema>;
export type CreateMeetingCard = z.infer<typeof CreateMeetingCardSchema>;
export type UpdateMeetingCard = z.infer<typeof UpdateMeetingCardSchema>;
export type CreateContactCard = z.infer<typeof CreateContactCardSchema>;
export type ContactChange = z.infer<typeof ContactChangeSchema>;
export type UpdateContactCard = z.infer<typeof UpdateContactCardSchema>;
export type MeetingChange = z.infer<typeof MeetingChangeSchema>;
export type MemoryProposal = z.infer<typeof MemoryProposalSchema>;
export type ActionCard = z.infer<typeof ActionCardSchema>;
export type ProviderInfo = z.infer<typeof ProviderInfoSchema>;
export type VisionProviderId = z.infer<typeof VisionProviderIdSchema>;
export type VisionImageDetail = z.infer<typeof VisionImageDetailSchema>;
export type VisionImageFormat = z.infer<typeof VisionImageFormatSchema>;
export type UserVisionProvider = z.infer<typeof UserVisionProviderSchema>;
export type AnalyzeResult = z.infer<typeof AnalyzeResultSchema>;
export type AnalyzeModelOutput = z.infer<typeof AnalyzeModelOutputSchema>;
export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;
export type ContactSummary = z.infer<typeof ContactSummarySchema>;
export type ContactRecord = z.infer<typeof ContactRecordSchema>;
export type MeetingRecord = z.infer<typeof MeetingRecordSchema>;
export type MeetingState = z.infer<typeof MeetingStateSchema>;
export type EntityMemory = z.infer<typeof EntityMemorySchema>;
export type FixtureId = z.infer<typeof FixtureIdSchema>;
export type ToolResult = z.infer<typeof ToolResultSchema>;
export type ActionExecutionRecord = z.infer<typeof ActionExecutionRecordSchema>;
export type MemoryEntry = z.infer<typeof MemoryEntrySchema>;
export type Insight = z.infer<typeof InsightSchema>;
export type InsightBundle = z.infer<typeof InsightBundleSchema>;
export type InsightRequest = z.infer<typeof InsightRequestSchema>;
export type InsightResult = z.infer<typeof InsightResultSchema>;
