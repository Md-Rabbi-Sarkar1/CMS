import type { NextFunction, Request, Response } from "express";

import { verifyAccessToken } from "../utils/jwt.js";
import { UnauthorizedError } from "../utils/errors.js";
import { ACCESS_TOKEN_COOKIE } from "../utils/cookies.js";

function readCookie(req: Request, name: string): string | undefined {
  const cookies = req.cookies as unknown as Record<string, unknown> | undefined;
  const value = cookies?.[name];
  return typeof value === "string" ? value : undefined;
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const token = readCookie(req, ACCESS_TOKEN_COOKIE);

  if (!token) {
    next(new UnauthorizedError("Access token required"));
    return;
  }

  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    next(new UnauthorizedError("Invalid or expired access token"));
  }
}

export function optionalAuthenticate(req: Request, _res: Response, next: NextFunction): void {
  const token = readCookie(req, ACCESS_TOKEN_COOKIE);

  if (!token) {
    next();
    return;
  }

  try {
    req.user = verifyAccessToken(token);
  } catch {
    // Invalid tokens are ignored for optional authentication.
  }

  next();
}
