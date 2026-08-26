import { describe, expect, it } from "vitest";

import { fromLocalDateTimeInput, parseDateTime, toLocalDateTimeInput } from "./dateTimeValue";

describe("date-time field values", () => {
  it("round-trips a browser-local date-time without exposing raw ISO text", () => {
    const iso = "2026-08-27T07:30:00.000Z";
    const local = toLocalDateTimeInput(iso);
    expect(local).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(fromLocalDateTimeInput(local)).toBe(iso);
  });

  it("treats empty and invalid values as unresolved", () => {
    expect(parseDateTime("not-a-date")).toBeNull();
    expect(fromLocalDateTimeInput("")).toBeUndefined();
  });
});
