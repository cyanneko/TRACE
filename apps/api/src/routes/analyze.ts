import { randomUUID } from "node:crypto";

import { AnalyzeRequestSchema, AnalyzeResultSchema } from "@trace/contracts";
import type { FastifyInstance } from "fastify";

import type { ModelProvider } from "../providers/modelProvider.js";
import type { Environment } from "../config.js";
import { createUserModelProvider } from "../providers/createProvider.js";
import { ModelOutputTruncatedError, ModelProviderTimeoutError } from "../providers/modelProviderErrors.js";
import { ModelOutputError } from "../providers/parseModelOutput.js";

export function registerAnalyzeRoute(app: FastifyInstance, provider: ModelProvider, environment: Environment) {
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
      const { visionProvider, ...analyzeInput } = parsedInput.data;
      const requestProvider = visionProvider ? createUserModelProvider(visionProvider, environment) : provider;
      const output = await requestProvider.analyze(analyzeInput);
      return AnalyzeResultSchema.parse({
        ...output,
        provider: requestProvider.info,
        runId: randomUUID(),
      });
    } catch (error) {
      request.log.error({ err: error }, "analysis provider failed");

      if (error instanceof ModelProviderTimeoutError) {
        return reply.status(504).send({
          error: {
            code: "MODEL_PROVIDER_TIMEOUT",
            message: "The vision model took too long to respond. Please retry.",
          },
        });
      }

      if (error instanceof ModelOutputTruncatedError) {
        return reply.status(502).send({
          error: {
            code: "MODEL_OUTPUT_TRUNCATED",
            message: "The vision model response was cut off before its JSON was complete. Please retry.",
          },
        });
      }

      const isInvalidOutput = error instanceof ModelOutputError;
      return reply.status(502).send({
        error: {
          code: isInvalidOutput ? "INVALID_MODEL_OUTPUT" : "MODEL_PROVIDER_FAILED",
          message: isInvalidOutput
            ? "The model response could not be validated. Please retry."
            : "The model provider is unavailable. Please retry.",
        },
      });
    }
  });
}
