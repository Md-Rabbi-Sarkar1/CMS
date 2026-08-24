import { Router } from "express";

import { isDatabaseReady } from "../providers/database.js";
import { sendSuccess } from "../utils/response.js";

export const healthRouter: Router = Router();

// Readiness probe: unhealthy until the initial database connection succeeds.
// The server intentionally stays up after a failed bootstrap connection so
// operators can diagnose the issue via this endpoint returning 503.
healthRouter.get("/", (_req, res) => {
  const databaseUp = isDatabaseReady();

  sendSuccess(res, { status: databaseUp ? "ok" : "unavailable", database: databaseUp ? "up" : "down" }, databaseUp ? 200 : 503);
});
