import { InsightRequestSchema, InsightResultSchema } from "@trace/contracts";
import type { FastifyInstance } from "fastify";

import { buildGroundedInsights } from "../insights/buildGroundedInsights.js";

const insightProvider = {
  fixture: true,
  id: "trace-policy",
  model: "grounded-insights-v1",
} as const;

export function registerInsightsRoute(app: FastifyInstance) {
  app.post("/v1/insights", async (request, reply) => {
    const parsedInput = InsightRequestSchema.safeParse(request.body);
    if (!parsedInput.success) {
      return reply.status(400).send({
        error: {
          code: "INVALID_INSIGHT_REQUEST",
          message: "The confirmed action context is invalid.",
          issues: parsedInput.error.issues,
        },
      });
    }

    const bundle = buildGroundedInsights(parsedInput.data);
    return InsightResultSchema.parse({
      ...bundle,
      sourceRunId: parsedInput.data.sourceRunId,
      generatedAt: new Date().toISOString(),
      provider: insightProvider,
    });
  });
}
