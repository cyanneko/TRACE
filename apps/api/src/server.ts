import cors from "@fastify/cors";
import Fastify from "fastify";

import type { Environment } from "./config.js";
import { readEnvironment } from "./config.js";
import { createModelProvider } from "./providers/createProvider.js";
import type { ModelProvider } from "./providers/modelProvider.js";
import { registerAnalyzeRoute } from "./routes/analyze.js";
import { registerInsightsRoute } from "./routes/insights.js";

type ServerOptions = {
  environment?: Environment;
  provider?: ModelProvider;
};

export function buildServer(options: ServerOptions = {}) {
  const environment = options.environment ?? readEnvironment();
  const provider = options.provider ?? createModelProvider(environment);
  const app = Fastify({
    bodyLimit: 16 * 1024 * 1024,
    logger: environment.NODE_ENV !== "test",
  });

  void app.register(cors, {
    origin: true,
  });

  app.get("/health", async () => ({
    modelProvider: provider.info,
    service: "trace-api",
    status: "ok",
  }));

  registerAnalyzeRoute(app, provider);
  registerInsightsRoute(app);

  return app;
}
