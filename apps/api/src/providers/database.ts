import { prisma as databasePrisma } from "@construction-ops/database";

import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

export const prisma = databasePrisma;

export async function connectDatabase(): Promise<void> {
  if (!env.DATABASE_URL) {
    logger.info("Database URL not configured; skipping Prisma connection test");
    return;
  }

  await prisma.$connect();
  logger.info("Database connection established");
}
