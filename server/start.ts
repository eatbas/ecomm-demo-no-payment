import { buildApp } from "./app.js";
import { readServerConfig } from "./config.js";

const config = readServerConfig();
const app = await buildApp({
  databasePath: config.databasePath,
  staticRoot: config.staticRoot,
  logger: true,
  jazzcash: config.jazzcash,
});

let shuttingDown = false;
async function shutDown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  app.log.info({ signal }, "Shutting down the order service");
  try {
    await app.close();
    process.exitCode = 0;
  } catch (error) {
    app.log.error({ err: error }, "The order service did not close cleanly");
    process.exitCode = 1;
  }
}

process.once("SIGINT", () => {
  void shutDown("SIGINT");
});
process.once("SIGTERM", () => {
  void shutDown("SIGTERM");
});

try {
  await app.listen({ host: config.host, port: config.port });
} catch (error) {
  app.log.error({ err: error }, "The order service could not start");
  await app.close();
  process.exitCode = 1;
}
