import type { MeetingSummary } from "@trace/contracts";

export interface MeetingSource {
  list(currentTime: string): Promise<MeetingSummary[]>;
}
