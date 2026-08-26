import type { ContactSummary } from "@trace/contracts";

export interface ContactSource {
  list(): Promise<ContactSummary[]>;
}
