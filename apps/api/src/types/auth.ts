import type { Request } from "express";

export const COMPANY_ROLES = ["ADMIN", "PROJECT_MANAGER", "ENGINEER", "WORKER"] as const;

export type CompanyRole = (typeof COMPANY_ROLES)[number];

export function isCompanyRole(value: unknown): value is CompanyRole {
  return typeof value === "string" && (COMPANY_ROLES as readonly string[]).includes(value);
}

export interface JWTPayload {
  sub: string;
  companyId: string;
  role: CompanyRole;
}

export interface AuthenticatedRequest extends Request {
  user: JWTPayload;
}
