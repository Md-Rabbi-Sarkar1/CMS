import type { Response } from "express";

import type { ApiErrorResponse } from "@construction-ops/shared";

export function sendSuccess(res: Response, data: unknown, statusCode = 200): void {
  res.status(statusCode).json({ success: true, data });
}

export function sendError(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: { field: string; message: string }[],
): void {
  const error: ApiErrorResponse["error"] = { code, message };
  if (details !== undefined) {
    error.details = details;
  }

  const body: ApiErrorResponse = { success: false, error };
  res.status(statusCode).json(body);
}
