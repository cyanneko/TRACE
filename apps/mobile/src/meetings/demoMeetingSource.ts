import type { MeetingSummary } from "@trace/contracts";

import type { MeetingSource } from "./types";

export class DemoMeetingSource implements MeetingSource {
  async list(): Promise<MeetingSummary[]> {
    return [
      {
        id: "meeting-design-review",
        externalEventId: "meeting-design-review",
        title: "与 Maya 的设计评审",
        startAt: "2026-08-27T07:00:00.000Z",
        endAt: "2026-08-27T07:30:00.000Z",
        timezone: "Asia/Shanghai",
        allDay: false,
        location: "",
        meetingLink: "",
        notes: "会前发送新版方案。",
        participantContactIds: ["contact-maya"],
      },
    ];
  }
}
