import type { NextFunction, Request, Response } from "express";

import { ForbiddenError } from "../utils/errors.js";

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (req.user?.role !== "ADMIN") {
    next(new ForbiddenError("ADMIN role required"));
    return;
  }

  next();
}
