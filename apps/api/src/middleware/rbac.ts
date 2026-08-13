import type { NextFunction, Request, Response } from "express";

import type { CompanyRole } from "../types/auth.js";
import { ForbiddenError, UnauthorizedError } from "../utils/errors.js";

export function authorize(...allowedRoles: CompanyRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError("Authentication required"));
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      next(new ForbiddenError("You do not have permission to perform this action"));
      return;
    }

    next();
  };
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    next(new UnauthorizedError("Authentication required"));
    return;
  }
  next();
}
