import "dotenv/config";

import { buildServer } from "./server.js";
import { readEnvironment } from "./config.js";

const environment = readEnvironment();
const app = buildServer({ environment });

try {
  await app.listen({ host: "0.0.0.0", port: environment.PORT });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
