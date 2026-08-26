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

const ActionCardBaseSchema = z.object({
  id: NonEmptyStringSchema,
  title: NonEmptyStringSchema,
  confidence: ConfidenceSchema,
  evidenceRefs: z.array(NonEmptyStringSchema),
  editableFields: z.array(NonEmptyStringSchema),
  riskFlags: z.array(NonEmptyStringSchema),
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

export const ActionCardSchema = z.discriminatedUnion("type", [
  CreateMeetingCardSchema,
  CreateContactCardSchema,
  UpdateContactCardSchema,
]);

export const ProviderInfoSchema = z.object({
  id: NonEmptyStringSchema,
  model: NonEmptyStringSchema,
  fixture: z.boolean(),
});

export const AnalyzeResultSchema = z.object({
  runId: z.uuid(),
  provider: ProviderInfoSchema,
  thread: ThreadContextSchema,
  actionCards: z.array(ActionCardSchema).max(3),
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

export const FixtureIdSchema = z.enum(["meeting", "new-contact", "update-contact", "no-action"]);

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
});

export const ToolResultSchema = z.object({
  actionId: NonEmptyStringSchema,
  success: z.boolean(),
  provider: z.enum(["native", "demo"]),
  externalId: z.string().optional(),
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
    confirmedActions: z.array(ActionCardSchema).max(3),
    toolResults: z.array(ToolResultSchema).max(3),
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
export type CreateContactCard = z.infer<typeof CreateContactCardSchema>;
export type ContactChange = z.infer<typeof ContactChangeSchema>;
export type UpdateContactCard = z.infer<typeof UpdateContactCardSchema>;
export type ActionCard = z.infer<typeof ActionCardSchema>;
export type ProviderInfo = z.infer<typeof ProviderInfoSchema>;
export type AnalyzeResult = z.infer<typeof AnalyzeResultSchema>;
export type AnalyzeModelOutput = z.infer<typeof AnalyzeModelOutputSchema>;
export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;
export type ContactSummary = z.infer<typeof ContactSummarySchema>;
export type FixtureId = z.infer<typeof FixtureIdSchema>;
export type ToolResult = z.infer<typeof ToolResultSchema>;
export type ActionExecutionRecord = z.infer<typeof ActionExecutionRecordSchema>;
export type MemoryEntry = z.infer<typeof MemoryEntrySchema>;
export type Insight = z.infer<typeof InsightSchema>;
export type InsightBundle = z.infer<typeof InsightBundleSchema>;
export type InsightRequest = z.infer<typeof InsightRequestSchema>;
export type InsightResult = z.infer<typeof InsightResultSchema>;
