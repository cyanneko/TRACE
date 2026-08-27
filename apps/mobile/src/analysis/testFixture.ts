import type { FixtureId } from "@trace/contracts";

const fixtureIds = new Set<FixtureId>([
  "meeting",
  "update-meeting",
  "new-contact",
  "update-contact",
  "contact-meeting",
  "self-meeting",
  "many-actions",
  "no-action",
]);

export function fixtureIdFromSearch(search: string | undefined): FixtureId | undefined {
  if (!search) return undefined;
  const value = new URLSearchParams(search).get("__trace_fixture");
  return value && fixtureIds.has(value as FixtureId) ? (value as FixtureId) : undefined;
}

export function activeTestFixtureId(): FixtureId | undefined {
  const location = (globalThis as { location?: { search?: string } }).location;
  return fixtureIdFromSearch(location?.search);
}
