import { config } from "dotenv";
import { fileURLToPath } from "node:url";

const apiDirectory = fileURLToPath(new URL("../", import.meta.url));
config({
  path: [`${apiDirectory}.env`, `${apiDirectory}../../.env`],
  quiet: true,
});

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
