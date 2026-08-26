import type { ContactSummary } from "@trace/contracts";
import { Contact, ContactField, requestPermissionsAsync } from "expo-contacts";

import type { ContactSource } from "./types";

const summaryFields = [
  ContactField.FULL_NAME,
  ContactField.GIVEN_NAME,
  ContactField.FAMILY_NAME,
  ContactField.COMPANY,
  ContactField.JOB_TITLE,
  ContactField.PHONES,
  ContactField.EMAILS,
] as const;

export class ExpoContactSource implements ContactSource {
  async list(): Promise<ContactSummary[]> {
    const permission = await requestPermissionsAsync();
    if (permission.status !== "granted") {
      return [];
    }

    const contacts = await Contact.getAllDetails(summaryFields, { limit: 200 });
    return contacts.flatMap((contact) => {
      const displayName =
        contact.fullName?.trim() ||
        [contact.givenName, contact.familyName].filter(Boolean).join(" ").trim();
      if (!displayName) {
        return [];
      }

      return [
        {
          id: contact.id,
          displayName,
          company: contact.company ?? "",
          jobTitle: contact.jobTitle ?? "",
          phones: contact.phones.map((phone) => phone.number).filter((value): value is string => Boolean(value)),
          emails: contact.emails.map((email) => email.address).filter((value): value is string => Boolean(value)),
        },
      ];
    });
  }
}
