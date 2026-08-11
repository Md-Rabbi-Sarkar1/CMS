import type { NextFunction, Request, Response } from "express";

import { AppError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { sendError } from "../utils/response.js";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    sendError(res, err.statusCode, err.code, err.message, err.details);
    return;
  }

  if (err instanceof SyntaxError && "statusCode" in err && err.statusCode === 400) {
    sendError(res, 400, "VALIDATION_ERROR", "Invalid request body");
    return;
  }

  logger.error("Unhandled error", err);
  sendError(res, 500, "INTERNAL_ERROR", "Internal server error");
}
