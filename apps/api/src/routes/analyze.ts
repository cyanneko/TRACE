import { randomUUID } from "node:crypto";

import { AnalyzeRequestSchema, AnalyzeResultSchema } from "@trace/contracts";
import type { FastifyInstance } from "fastify";

import type { ModelProvider } from "../providers/modelProvider.js";
import { ModelOutputError } from "../providers/parseModelOutput.js";

export function registerAnalyzeRoute(app: FastifyInstance, provider: ModelProvider) {
  app.post("/v1/analyze", async (request, reply) => {
    const parsedInput = AnalyzeRequestSchema.safeParse(request.body);
    if (!parsedInput.success) {
      return reply.status(400).send({
        error: {
          code: "INVALID_ANALYZE_REQUEST",
          message: "The screenshot context is invalid.",
          issues: parsedInput.error.issues,
        },
      });
    }

    try {
      const output = await provider.analyze(parsedInput.data);
      return AnalyzeResultSchema.parse({
        ...output,
        provider: provider.info,
        runId: randomUUID(),
      });
    } catch (error) {
      request.log.error({ err: error }, "analysis provider failed");

      const isModelOutputError = error instanceof ModelOutputError;
      return reply.status(502).send({
        error: {
          code: isModelOutputError ? "INVALID_MODEL_OUTPUT" : "MODEL_PROVIDER_FAILED",
          message: isModelOutputError
            ? "The model response could not be validated. Please retry."
            : "The model provider is unavailable. Please retry.",
        },
      });
    }
  });
}
