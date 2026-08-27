import { describe, expect, it } from "vitest";

import { fixtureIdFromSearch } from "./testFixture";

describe("fixtureIdFromSearch", () => {
  it("accepts an explicit internal fixture query", () => {
    expect(fixtureIdFromSearch("?__trace_fixture=self-meeting")).toBe("self-meeting");
  });

  it("ignores unknown and absent fixture values", () => {
    expect(fixtureIdFromSearch("?__trace_fixture=unknown")).toBeUndefined();
    expect(fixtureIdFromSearch("")).toBeUndefined();
  });
});
