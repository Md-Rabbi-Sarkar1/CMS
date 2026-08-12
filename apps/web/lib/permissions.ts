import type { CompanyRole } from "./api-client";

export function canCreateProject(role: CompanyRole): boolean {
  return role === "ADMIN" || role === "PROJECT_MANAGER";
}

export function canManageProject(role: CompanyRole, managerId: string | null, userId: string | null): boolean {
  if (role === "ADMIN") {
    return true;
  }

  return role === "PROJECT_MANAGER" && managerId === userId;
}
