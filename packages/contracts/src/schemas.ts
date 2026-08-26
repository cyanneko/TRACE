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

export const ProviderModeSchema = z.enum(["deepseek", "fixture"]);

export const AnalyzeResultSchema = z.object({
  runId: z.uuid(),
  provider: ProviderModeSchema,
  thread: ThreadContextSchema,
  actionCards: z.array(ActionCardSchema).max(3),
});

export const ContactSummarySchema = z.object({
  id: NonEmptyStringSchema,
  displayName: NonEmptyStringSchema,
  company: z.string(),
  jobTitle: z.string(),
  phones: z.array(z.string()),
  emails: z.array(z.string()),
});

export const ToolResultSchema = z.object({
  actionId: NonEmptyStringSchema,
  success: z.boolean(),
  provider: z.enum(["native", "demo"]),
  externalId: z.string().optional(),
  error: z.string().optional(),
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
  nextStep: z.string().optional(),
  suggestedMessage: z.string().optional(),
});

export const InsightBundleSchema = z.object({
  insights: z.array(InsightSchema).max(3),
  unresolvedQuestions: z.array(NonEmptyStringSchema),
});

export type Evidence = z.infer<typeof EvidenceSchema>;
export type ThreadParticipant = z.infer<typeof ThreadParticipantSchema>;
export type ThreadContext = z.infer<typeof ThreadContextSchema>;
export type CreateMeetingCard = z.infer<typeof CreateMeetingCardSchema>;
export type CreateContactCard = z.infer<typeof CreateContactCardSchema>;
export type ContactChange = z.infer<typeof ContactChangeSchema>;
export type UpdateContactCard = z.infer<typeof UpdateContactCardSchema>;
export type ActionCard = z.infer<typeof ActionCardSchema>;
export type ProviderMode = z.infer<typeof ProviderModeSchema>;
export type AnalyzeResult = z.infer<typeof AnalyzeResultSchema>;
export type ContactSummary = z.infer<typeof ContactSummarySchema>;
export type ToolResult = z.infer<typeof ToolResultSchema>;
export type MemoryEntry = z.infer<typeof MemoryEntrySchema>;
export type Insight = z.infer<typeof InsightSchema>;
export type InsightBundle = z.infer<typeof InsightBundleSchema>;
