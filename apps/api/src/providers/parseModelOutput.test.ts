import { describe, expect, it, vi } from "vitest";

import { getAnalyzeFixture } from "../fixtures/analyzeFixtures.js";
import { ModelOutputError, parseAnalyzeOutputWithRepair } from "./parseModelOutput.js";

describe("parseAnalyzeOutputWithRepair", () => {
  it("returns a valid first response without a repair call", async () => {
    const repair = vi.fn();

    const result = await parseAnalyzeOutputWithRepair({
      initial: async () => JSON.stringify(getAnalyzeFixture("meeting")),
      repair,
    });

    expect(result.actionCards[0]?.type).toBe("create_meeting");
    expect(repair).not.toHaveBeenCalled();
  });

  it("repairs invalid JSON once", async () => {
    const repair = vi.fn(async () => JSON.stringify(getAnalyzeFixture("new-contact")));

    const result = await parseAnalyzeOutputWithRepair({
      initial: async () => "not-json",
      repair,
    });

    expect(result.actionCards[0]?.type).toBe("create_contact");
    expect(repair).toHaveBeenCalledOnce();
    expect(repair).toHaveBeenCalledWith("not-json");
  });

  it("fails after one unsuccessful repair", async () => {
    const repair = vi.fn(async () => "still-not-json");

    await expect(
      parseAnalyzeOutputWithRepair({
        initial: async () => "not-json",
        repair,
      }),
    ).rejects.toBeInstanceOf(ModelOutputError);

    expect(repair).toHaveBeenCalledOnce();
  });
});
