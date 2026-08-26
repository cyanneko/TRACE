import type { MeetingSummary } from "@trace/contracts";
import * as Calendar from "expo-calendar";

import type { MeetingSource } from "./types";

const DAY = 24 * 60 * 60 * 1_000;

function isoDate(value: Date | string): string {
  return new Date(value).toISOString();
}

export class ExpoMeetingSource implements MeetingSource {
  async list(currentTime: string): Promise<MeetingSummary[]> {
    const permission = await Calendar.requestCalendarPermissions(false);
    if (permission.status !== "granted") {
      return [];
    }

    const now = new Date(currentTime);
    const calendars = (await Calendar.getCalendars(Calendar.EntityTypes.EVENT)).filter(
      (calendar) => calendar.allowsModifications,
    );
    if (calendars.length === 0) {
      return [];
    }
    const events = await Calendar.listEvents(
      calendars,
      new Date(now.getTime() - 90 * DAY),
      new Date(now.getTime() + 365 * DAY),
    );

    return events
      .flatMap((event) => {
        const title = event.title.trim();
        if (!title) return [];
        return [
          {
            id: event.id,
            externalEventId: event.id,
            title,
            startAt: isoDate(event.startDate),
            endAt: isoDate(event.endDate),
            timezone: event.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
            allDay: event.allDay,
            location: event.location ?? "",
            meetingLink: event.url ?? "",
            notes: event.notes ?? "",
            participantContactIds: [],
          },
        ];
      })
      .sort((left, right) => left.startAt.localeCompare(right.startAt))
      .slice(0, 200);
  }
}
