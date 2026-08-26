import type { ContactSummary } from "@trace/contracts";

import { demoContacts } from "../data/demoContacts";
import type { ContactSource } from "./types";

export class DemoContactSource implements ContactSource {
  async list(): Promise<ContactSummary[]> {
    return structuredClone(demoContacts);
  }
}
