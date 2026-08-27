import { randomUUID } from "node:crypto";

import { AnalyzeRequestSchema, AnalyzeResultSchema } from "@trace/contracts";
import type { FastifyInstance } from "fastify";

import { applyAnalysisScope } from "../analysis/applyAnalysisScope.js";
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
      const output = applyAnalysisScope(analyzeInput, await requestProvider.analyze(analyzeInput));
      const result = AnalyzeResultSchema.parse({
        ...output,
        provider: requestProvider.info,
        runId: randomUUID(),
      });
      request.log.info(
        {
          actionCount: result.actionCards.length,
          actionScope: analyzeInput.actionScope,
          actionTypes: result.actionCards.map((card) => card.type),
        },
        "analysis completed",
      );
      return result;
    } catch (error) {
      if (error instanceof ModelOutputError) {
        request.log.error(
          { code: "INVALID_MODEL_OUTPUT", issues: error.issues },
          "analysis provider returned invalid structured output",
        );
      } else {
        request.log.error({ err: error }, "analysis provider failed");
      }

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
      const firstIssue = isInvalidOutput ? error.issues[0] : undefined;
      const invalidOutputMessage = firstIssue
        ? `The model returned invalid structured data at ${firstIssue.path}: ${firstIssue.message} Please retry.`
        : "The model response could not be validated. Please retry.";
      return reply.status(502).send({
        error: {
          code: isInvalidOutput ? "INVALID_MODEL_OUTPUT" : "MODEL_PROVIDER_FAILED",
          message: isInvalidOutput ? invalidOutputMessage : "The model provider is unavailable. Please retry.",
          ...(isInvalidOutput ? { issues: error.issues } : {}),
        },
      });
    }
  });
}
