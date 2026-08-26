import { buildServer } from "./server.js";

const app = buildServer();
const port = Number(process.env.PORT ?? 8787);

try {
  await app.listen({ host: "0.0.0.0", port });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
