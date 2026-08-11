import { randomUUID } from "node:crypto";

import jwt from "jsonwebtoken";

import { env } from "../config/env.js";
import { isCompanyRole, type JWTPayload } from "../types/auth.js";
import { UnauthorizedError } from "./errors.js";

const ACCESS_TOKEN_EXPIRY = "15m";

export function createAccessToken(payload: JWTPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
    jwtid: randomUUID(),
  });
}

export function verifyAccessToken(token: string): JWTPayload {
  let decoded: unknown;

  try {
    decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
  } catch {
    throw new UnauthorizedError("Invalid or expired access token");
  }

  if (typeof decoded === "string") {
    throw new UnauthorizedError("Invalid or expired access token");
  }

  const payload = decoded as { sub?: unknown; companyId?: unknown; role?: unknown };

  if (
    typeof payload.sub !== "string" ||
    typeof payload.companyId !== "string" ||
    !isCompanyRole(payload.role)
  ) {
    throw new UnauthorizedError("Invalid or expired access token");
  }

  return {
    sub: payload.sub,
    companyId: payload.companyId,
    role: payload.role,
  };
}
