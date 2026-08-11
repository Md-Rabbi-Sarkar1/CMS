import { app } from "./app.js";
import { env } from "./config/env.js";
import { connectDatabase } from "./providers/database.js";
import { logger } from "./utils/logger.js";

const port = env.PORT;

async function bootstrap(): Promise<void> {
  try {
    await connectDatabase();
  } catch (error) {
    logger.error("Database connection failed; continuing with health endpoints available", error);
  }

  const server = app.listen(port, () => {
    logger.info(`API listening on port ${String(port)}`);
  });

  function shutdown(): void {
    server.close(() => {
      process.exit(0);
    });
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

bootstrap().catch((error: unknown) => {
  logger.error("Failed to start API", error);
  process.exit(1);
});

export { app };
