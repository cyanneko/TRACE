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
        payload: {
          displayName: "林乔",
          givenName: "乔",
          familyName: "林",
          company: "Northstar",
          jobTitle: "",
          phones: [],
          emails: ["linqiao@example.com"],
          notes: "希望下周继续讨论合作。",
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
