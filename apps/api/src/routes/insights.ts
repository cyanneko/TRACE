import { InsightRequestSchema, InsightResultSchema } from "@trace/contracts";
import type { FastifyInstance } from "fastify";

import type { Environment } from "../config.js";
import { createUserModelProvider } from "../providers/createProvider.js";
import type { ModelProvider } from "../providers/modelProvider.js";
import { ModelOutputTruncatedError, ModelProviderTimeoutError } from "../providers/modelProviderErrors.js";
import { ModelOutputError } from "../providers/parseModelOutput.js";

export function registerInsightsRoute(app: FastifyInstance, provider: ModelProvider, environment: Environment) {
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

    try {
      const { visionProvider, ...insightInput } = parsedInput.data;
      const requestProvider = visionProvider ? createUserModelProvider(visionProvider, environment) : provider;
      const bundle = await requestProvider.generateInsights(insightInput);
      const result = InsightResultSchema.parse({
        ...bundle,
        sourceRunId: insightInput.sourceRunId,
        generatedAt: new Date().toISOString(),
        provider: requestProvider.info,
      });
      request.log.info(
        {
          globalMemoryOperationCount: result.globalMemoryOperations.length,
          insightCount: result.insights.length,
        },
        "insights completed",
      );
      return result;
    } catch (error) {
      if (error instanceof ModelOutputError) {
        request.log.error(
          { code: "INVALID_INSIGHT_OUTPUT", issues: error.issues },
          "insight provider returned invalid structured output",
        );
      } else {
        request.log.error({ err: error }, "insight provider failed");
      }

      if (error instanceof ModelProviderTimeoutError) {
        return reply.status(504).send({
          error: {
            code: "MODEL_PROVIDER_TIMEOUT",
            message: "The insight model took too long to respond. Please retry.",
          },
        });
      }

      if (error instanceof ModelOutputTruncatedError) {
        return reply.status(502).send({
          error: {
            code: "MODEL_OUTPUT_TRUNCATED",
            message: "The insight model response was cut off before its JSON was complete. Please retry.",
          },
        });
      }

      const isInvalidOutput = error instanceof ModelOutputError;
      const firstIssue = isInvalidOutput ? error.issues[0] : undefined;
      const invalidOutputMessage = firstIssue
        ? `The insight model returned invalid structured data at ${firstIssue.path}: ${firstIssue.message} Please retry.`
        : "The insight model response could not be validated. Please retry.";
      return reply.status(502).send({
        error: {
          code: isInvalidOutput ? "INVALID_MODEL_OUTPUT" : "MODEL_PROVIDER_FAILED",
          message: isInvalidOutput ? invalidOutputMessage : "The insight model provider is unavailable. Please retry.",
          ...(isInvalidOutput ? { issues: error.issues } : {}),
        },
      });
    }
  });
}
