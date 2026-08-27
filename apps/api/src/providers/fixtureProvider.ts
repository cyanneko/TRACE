import type { AnalyzeRequest, InsightRequest } from "@trace/contracts";

import { getAnalyzeFixture } from "../fixtures/analyzeFixtures.js";
import { buildGroundedInsights } from "../insights/buildGroundedInsights.js";
import type { ModelProvider } from "./modelProvider.js";

export class FixtureProvider implements ModelProvider {
  readonly info = {
    fixture: true,
    id: "fixture",
    model: "trace-analyze-fixtures",
  } as const;

  async analyze(input: AnalyzeRequest) {
    return getAnalyzeFixture(input.fixtureId ?? "meeting");
  }

  async generateInsights(input: InsightRequest) {
    return buildGroundedInsights(input);
  }
}
