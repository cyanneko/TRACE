import {
  ActionExecutionRecordSchema,
  type ActionCard,
  type ActionExecutionRecord,
  type ToolResult,
} from "@trace/contracts";
import * as Calendar from "expo-calendar";
import {
  Contact,
  requestPermissionsAsync as requestContactsPermissions,
  type ContactPatch,
} from "expo-contacts";
import { Platform } from "react-native";

import { getTraceDatabase } from "../native/traceDatabase";
import type { ActionExecutionContext, ActionExecutor } from "./types";

type ActionEventRow = {
  payload: string;
};

function failed(actionId: string, error: string): ToolResult {
  return {
    actionId,
    success: false,
    provider: "native",
    error,
  };
}

export class ExpoActionExecutor implements ActionExecutor {
  async execute(sourceRunId: string, action: ActionCard, context?: ActionExecutionContext): Promise<ToolResult> {
    const idempotencyKey = `${sourceRunId}:${action.id}`;
    const existing = await this.findExisting(idempotencyKey);
    if (existing) {
      return existing.result;
    }

    const result = await this.perform(action, context);
    if (result.success) {
      await this.record({
        idempotencyKey,
        sourceRunId,
        action,
        result,
        executedAt: new Date().toISOString(),
      });
    }
    return result;
  }

  private async perform(action: ActionCard, context?: ActionExecutionContext): Promise<ToolResult> {
    try {
      if (action.type === "create_meeting") {
        return await this.createMeeting(action);
      }
      if (action.type === "create_contact") {
        return await this.createContact(action);
      }
      if (action.type === "update_contact") {
        return await this.updateContact(action, context?.targetExternalId);
      }
      return await this.updateMeeting(action, context?.targetExternalId);
    } catch (error) {
      return failed(action.id, error instanceof Error ? error.message : "The native write failed.");
    }
  }

  private async createMeeting(action: Extract<ActionCard, { type: "create_meeting" }>): Promise<ToolResult> {
    if (!action.payload.startAt || !action.payload.endAt) {
      return failed(action.id, "Meeting start and end times are required before confirmation.");
    }

    const permission = await Calendar.requestCalendarPermissions(false);
    if (permission.status !== "granted") {
      return failed(action.id, "Calendar write permission was not granted.");
    }

    const calendar =
      Platform.OS === "ios"
        ? Calendar.getDefaultCalendarSync()
        : (await Calendar.getCalendars(Calendar.EntityTypes.EVENT)).find((item) => item.allowsModifications);
    if (!calendar) {
      return failed(action.id, "No writable calendar is available on this device.");
    }

    const event = await calendar.createEvent({
      title: action.payload.title,
      startDate: new Date(action.payload.startAt),
      endDate: new Date(action.payload.endAt),
      timeZone: action.payload.timezone,
      notes: action.payload.notes,
    });
    return {
      actionId: action.id,
      success: true,
      provider: "native",
      externalId: event.id,
    };
  }

  private async createContact(action: Extract<ActionCard, { type: "create_contact" }>): Promise<ToolResult> {
    const permission = await requestContactsPermissions();
    if (permission.status !== "granted") {
      return failed(action.id, "Contacts permission was not granted.");
    }

    const contact = await Contact.create({
      givenName: action.payload.givenName || action.payload.displayName,
      familyName: action.payload.familyName,
      company: action.payload.company,
      jobTitle: action.payload.jobTitle,
      note: action.payload.notes,
      phones: action.payload.phones.map((number) => ({ label: "mobile", number })),
      emails: action.payload.emails.map((address) => ({ label: "work", address })),
    });
    return {
      actionId: action.id,
      success: true,
      provider: "native",
      externalId: contact.id,
    };
  }

  private async updateContact(
    action: Extract<ActionCard, { type: "update_contact" }>,
    targetExternalId?: string,
  ): Promise<ToolResult> {
    const contactId = targetExternalId ?? action.payload.contactId;
    if (!contactId) {
      return failed(action.id, "A matched contact is required before updating native contacts.");
    }

    const permission = await requestContactsPermissions();
    if (permission.status !== "granted") {
      return failed(action.id, "Contacts permission was not granted.");
    }

    const contact = new Contact(contactId);
    const patch: ContactPatch = {};
    const phoneChanges = action.payload.changes.filter((change) => change.field === "phone");
    const emailChanges = action.payload.changes.filter((change) => change.field === "email");

    for (const change of action.payload.changes) {
      if (change.field === "company") patch.company = change.nextValue;
      if (change.field === "jobTitle") patch.jobTitle = change.nextValue;
      if (change.field === "givenName") patch.givenName = change.nextValue;
      if (change.field === "familyName") patch.familyName = change.nextValue;
      if (change.field === "notes") patch.note = change.nextValue;
      if (change.field === "displayName") {
        patch.givenName = change.nextValue;
        patch.familyName = null;
      }
    }

    if (phoneChanges.length > 0) {
      const phones: NonNullable<ContactPatch["phones"]> = [...(await contact.getPhones())];
      for (const change of phoneChanges) {
        const index = change.previousValue
          ? phones.findIndex((phone) => phone.number === change.previousValue)
          : -1;
        if (index >= 0) {
          phones[index] = { ...phones[index]!, number: change.nextValue };
        } else {
          phones.push({ label: "mobile", number: change.nextValue });
        }
      }
      patch.phones = phones;
    }

    if (emailChanges.length > 0) {
      const emails: NonNullable<ContactPatch["emails"]> = [...(await contact.getEmails())];
      for (const change of emailChanges) {
        const index = change.previousValue
          ? emails.findIndex((email) => email.address === change.previousValue)
          : -1;
        if (index >= 0) {
          emails[index] = { ...emails[index]!, address: change.nextValue };
        } else {
          emails.push({ label: "work", address: change.nextValue });
        }
      }
      patch.emails = emails;
    }

    await contact.patch(patch);
    return {
      actionId: action.id,
      success: true,
      provider: "native",
      externalId: contact.id,
    };
  }

  private async updateMeeting(
    action: Extract<ActionCard, { type: "update_meeting" }>,
    targetExternalId?: string,
  ): Promise<ToolResult> {
    const patch: Partial<Calendar.ModifiableEventProperties> = {};
    for (const change of action.payload.changes) {
      if (change.field === "title") patch.title = change.nextValue!;
      if (change.field === "timezone") patch.timeZone = change.nextValue!;
      if (change.field === "location") patch.location = change.nextValue;
      if (change.field === "meetingLink") patch.url = change.nextValue ?? "";
      if (change.field === "notes") patch.notes = change.nextValue ?? "";
      if (change.field === "startAt") {
        if (!change.nextValue) return failed(action.id, "A meeting start time cannot be cleared.");
        patch.startDate = new Date(change.nextValue);
      }
      if (change.field === "endAt") {
        if (!change.nextValue) return failed(action.id, "A meeting end time cannot be cleared.");
        patch.endDate = new Date(change.nextValue);
      }
    }

    const hasCalendarChanges = Object.keys(patch).length > 0;
    if (hasCalendarChanges) {
      if (!targetExternalId) {
        return failed(action.id, "A linked calendar event is required before updating this meeting.");
      }
      const permission = await Calendar.requestCalendarPermissions(false);
      if (permission.status !== "granted") {
        return failed(action.id, "Calendar access permission was not granted.");
      }
      const event = await Calendar.ExpoCalendarEvent.get(targetExternalId);
      await event.update(patch);
    }

    return {
      actionId: action.id,
      success: true,
      provider: "native",
      externalId: targetExternalId,
    };
  }

  private async findExisting(idempotencyKey: string): Promise<ActionExecutionRecord | null> {
    const database = await getTraceDatabase();
    const row = await database.getFirstAsync<ActionEventRow>(
      "SELECT payload FROM action_events WHERE idempotency_key = ?",
      idempotencyKey,
    );
    if (!row) {
      return null;
    }

    try {
      const parsed = ActionExecutionRecordSchema.safeParse(JSON.parse(row.payload));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }

  private async record(record: ActionExecutionRecord): Promise<void> {
    const database = await getTraceDatabase();
    await database.runAsync(
      `INSERT OR IGNORE INTO action_events (idempotency_key, payload, executed_at)
       VALUES (?, ?, ?)`,
      record.idempotencyKey,
      JSON.stringify(record),
      record.executedAt,
    );
  }
}
