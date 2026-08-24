import { prisma as databasePrisma } from "@construction-ops/database";

import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

export const prisma = databasePrisma;

// Tracked by the API bootstrap so the health endpoint can report readiness
// accurately: it returns 503 when the initial database connection failed.
let databaseReady = false;

export function isDatabaseReady(): boolean {
  return databaseReady;
}

export async function connectDatabase(): Promise<void> {
  if (!env.DATABASE_URL) {
    logger.info("Database URL not configured; skipping Prisma connection test");
    return;
  }

  await prisma.$connect();
  databaseReady = true;
  logger.info("Database connection established");
}
