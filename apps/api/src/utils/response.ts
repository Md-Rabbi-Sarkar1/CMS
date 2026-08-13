import type { Response } from "express";

import type { ApiErrorResponse, ApiSuccessResponse } from "@construction-ops/shared";

export function sendSuccess(
  res: Response,
  data: unknown,
  statusCode = 200,
  page?: number,
  pageSize?: number,
  total?: number,
): void {
  const body: { success: true; data: unknown; meta?: { page: number; pageSize: number; total: number } } = {
    success: true,
    data,
  };
  if (page !== undefined && pageSize !== undefined && total !== undefined) {
    body.meta = { page, pageSize, total };
  }
  res.status(statusCode).json(body);
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
