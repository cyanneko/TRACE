import cors from "@fastify/cors";
import Fastify from "fastify";

export function buildServer() {
  const app = Fastify({
    logger: process.env.NODE_ENV !== "test",
  });

  void app.register(cors, {
    origin: true,
  });

  app.get("/health", async () => ({
    service: "trace-api",
    status: "ok",
  }));

  return app;
}
