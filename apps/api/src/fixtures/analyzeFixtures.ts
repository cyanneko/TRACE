import type { AnalyzeModelOutput, FixtureId } from "@trace/contracts";
import { AnalyzeModelOutputSchema } from "@trace/contracts";

const fixtures = {
  meeting: {
    thread: {
      summary: "Maya 确认明天下午三点进行 30 分钟设计评审，并希望会前收到新版方案。",
      participants: [
        {
          displayName: "Maya Chen",
          contactId: "contact-maya",
          confidence: 0.96,
        },
      ],
      evidence: [
        {
          id: "evidence-meeting-time",
          quote: "那就明天下午 3 点，半小时可以吗？",
          speaker: "Maya",
          timestampText: "10:42",
        },
        {
          id: "evidence-send-deck",
          quote: "可以，开会前把新版方案发我就好。",
          speaker: "Maya",
          timestampText: "10:43",
        },
      ],
      uncertainties: [],
    },
    actionCards: [
      {
        id: "action-create-meeting",
        type: "create_meeting",
        title: "创建与 Maya 的设计评审",
        confidence: 0.95,
        evidenceRefs: ["evidence-meeting-time", "evidence-send-deck"],
        editableFields: ["title", "startAt", "endAt", "notes"],
        riskFlags: [],
        memoryProposals: [
          {
            target: { type: "action_entity" },
            kind: "commitment",
            content: "会前向 Maya 发送新版方案。",
            evidenceRefs: ["evidence-send-deck"],
          },
        ],
        payload: {
          title: "与 Maya 的设计评审",
          startAt: "2026-08-27T07:00:00.000Z",
          endAt: "2026-08-27T07:30:00.000Z",
          timezone: "Asia/Shanghai",
          participantContactIds: ["contact-maya"],
          participantNames: ["Maya Chen"],
          notes: "会前发送新版方案。",
        },
      },
    ],
  },
  "new-contact": {
    thread: {
      summary: "林乔介绍了自己的公司邮箱，并希望下周继续讨论合作。",
      participants: [
        {
          displayName: "林乔",
          confidence: 0.91,
        },
      ],
      evidence: [
        {
          id: "evidence-new-contact",
          quote: "我是 Northstar 的林乔，邮箱 linqiao@example.com。",
          speaker: "林乔",
        },
      ],
      uncertainties: ["截图中没有提供电话号码。"],
    },
    actionCards: [
      {
        id: "action-create-contact",
        type: "create_contact",
        title: "创建联系人林乔",
        confidence: 0.91,
        evidenceRefs: ["evidence-new-contact"],
        editableFields: ["displayName", "company", "jobTitle", "phones", "emails"],
        riskFlags: [],
        memoryProposals: [
          {
            target: { type: "action_entity" },
            kind: "context",
            content: "林乔希望下周继续讨论合作。",
            evidenceRefs: ["evidence-new-contact"],
          },
        ],
        payload: {
          displayName: "林乔",
          givenName: "乔",
          familyName: "林",
          company: "Northstar",
          jobTitle: "",
          phones: [],
          emails: ["linqiao@example.com"],
          notes: "希望下周继续讨论合作。",
          isSelf: false,
          interactionSummary: "林乔主动介绍自己并提出下周继续讨论合作。",
        },
      },
    ],
  },
  "update-contact": {
    thread: {
      summary: "Maya 告知用户她已经加入 Northstar，职位是产品负责人。",
      participants: [
        {
          displayName: "Maya Chen",
          contactId: "contact-maya",
          confidence: 0.98,
        },
      ],
      evidence: [
        {
          id: "evidence-new-role",
          quote: "我刚加入 Northstar，现在负责产品。",
          speaker: "Maya",
        },
      ],
      uncertainties: [],
    },
    actionCards: [
      {
        id: "action-update-contact",
        type: "update_contact",
        title: "更新 Maya 的任职信息",
        confidence: 0.96,
        evidenceRefs: ["evidence-new-role"],
        editableFields: ["changes"],
        riskFlags: [],
        memoryProposals: [
          {
            target: { type: "contact", contactId: "contact-maya" },
            kind: "context",
            content: "Maya 的沟通重点可能转向产品负责人职责。",
            evidenceRefs: ["evidence-new-role"],
          },
        ],
        payload: {
          contactId: "contact-maya",
          displayName: "Maya Chen",
          changes: [
            {
              field: "company",
              previousValue: "Atelier",
              nextValue: "Northstar",
            },
            {
              field: "jobTitle",
              previousValue: "Product Designer",
              nextValue: "Head of Product",
            },
          ],
        },
      },
    ],
  },
  "update-meeting": {
    thread: {
      summary: "Maya 将设计评审从周四下午三点改到周五下午四点，时长仍为 30 分钟。",
      participants: [
        {
          displayName: "Maya Chen",
          contactId: "contact-maya",
          confidence: 0.97,
        },
      ],
      evidence: [
        {
          id: "evidence-reschedule",
          quote: "周四来不及了，改到周五下午 4 点吧，还是半小时。",
          speaker: "Maya",
          timestampText: "11:08",
        },
      ],
      uncertainties: [],
    },
    actionCards: [
      {
        id: "action-update-meeting",
        type: "update_meeting",
        title: "将设计评审改到周五下午四点",
        confidence: 0.94,
        evidenceRefs: ["evidence-reschedule"],
        editableFields: ["meetingId", "changes"],
        riskFlags: [],
        memoryProposals: [
          {
            target: { type: "meeting", meetingId: "meeting-design-review" },
            kind: "context",
            content: "Maya 因周四时间不足提出改期。",
            evidenceRefs: ["evidence-reschedule"],
          },
        ],
        payload: {
          meetingId: "meeting-design-review",
          displayTitle: "与 Maya 的设计评审",
          changes: [
            {
              field: "startAt",
              previousValue: "2026-08-27T07:00:00.000Z",
              nextValue: "2026-08-28T08:00:00.000Z",
            },
            {
              field: "endAt",
              previousValue: "2026-08-27T07:30:00.000Z",
              nextValue: "2026-08-28T08:30:00.000Z",
            },
          ],
        },
      },
    ],
  },
  "many-actions": {
    thread: {
      summary: "四位新参与者分别与用户确认了后续联系，TRACE 为每个人保留独立联系人行动。",
      participants: ["安然", "陈墨", "River", "周序"].map((displayName) => ({
        displayName,
        confidence: 0.86,
      })),
      evidence: ["安然", "陈墨", "River", "周序"].map((displayName, index) => ({
        id: `evidence-person-${index + 1}`,
        quote: `${displayName}：好的，我们保持联系。`,
        speaker: displayName,
      })),
      uncertainties: [],
    },
    actionCards: ["安然", "陈墨", "River", "周序"].map((displayName, index) => ({
      id: `action-contact-${index + 1}`,
      type: "create_contact" as const,
      title: `创建联系人 ${displayName}`,
      confidence: 0.86,
      evidenceRefs: [`evidence-person-${index + 1}`],
      editableFields: ["displayName"],
      riskFlags: [],
      memoryProposals: [
        {
          target: { type: "action_entity" as const },
          kind: "context" as const,
          content: `${displayName} 与用户确认保持联系。`,
          evidenceRefs: [`evidence-person-${index + 1}`],
        },
      ],
      payload: {
        displayName,
        givenName: "",
        familyName: "",
        company: "",
        jobTitle: "",
        phones: [],
        emails: [],
        notes: "",
        isSelf: false,
        interactionSummary: `${displayName} 与用户发生了直接互动。`,
      },
    })),
  },
  "no-action": {
    thread: {
      summary: "双方只是简单问候，没有形成承诺、联系人变更或会议安排。",
      participants: [
        {
          displayName: "Maya Chen",
          contactId: "contact-maya",
          confidence: 0.88,
        },
      ],
      evidence: [
        {
          id: "evidence-greeting",
          quote: "最近怎么样？改天聊。",
          speaker: "Maya",
        },
      ],
      uncertainties: ["“改天聊”没有明确日期或承诺，不应创建会议。"],
    },
    actionCards: [],
  },
} satisfies Record<FixtureId, AnalyzeModelOutput>;

export function getAnalyzeFixture(id: FixtureId): AnalyzeModelOutput {
  return AnalyzeModelOutputSchema.parse(structuredClone(fixtures[id]));
}
