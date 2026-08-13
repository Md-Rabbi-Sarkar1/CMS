import type { CompanyRole } from "@construction-ops/shared";

// UI-level permission helpers (non-authoritative). Backend RBAC is authoritative.
export const PERMISSIONS = {
  manageCompany: (role: CompanyRole) => role === "ADMIN",
  manageUsers: (role: CompanyRole) => role === "ADMIN",
  createProject: (role: CompanyRole) => role === "ADMIN" || role === "PROJECT_MANAGER",
  updateProject: (role: CompanyRole) => role === "ADMIN" || role === "PROJECT_MANAGER",
  deleteProject: (role: CompanyRole) => role === "ADMIN",
  manageTeam: (role: CompanyRole) => role === "ADMIN" || role === "PROJECT_MANAGER",
  createTask: (role: CompanyRole) =>
    role === "ADMIN" || role === "PROJECT_MANAGER" || role === "ENGINEER",
  submitReport: (role: CompanyRole) => role === "ENGINEER" || role === "WORKER",
  reviewReport: (role: CompanyRole) => role === "ADMIN" || role === "PROJECT_MANAGER",
  manageMaterial: (role: CompanyRole) =>
    role === "ADMIN" || role === "PROJECT_MANAGER" || role === "ENGINEER",
  recordInventory: (role: CompanyRole) =>
    role === "ADMIN" || role === "PROJECT_MANAGER" || role === "ENGINEER",
  createExpense: (_role: CompanyRole) => true,
  reviewExpense: (role: CompanyRole) => role === "ADMIN" || role === "PROJECT_MANAGER",
  manageIssue: (_role: CompanyRole) => true,
  uploadDocument: (role: CompanyRole) =>
    role === "ADMIN" || role === "PROJECT_MANAGER" || role === "ENGINEER",
  viewAnalytics: (role: CompanyRole) => role === "ADMIN" || role === "PROJECT_MANAGER",
} as const;

export type Permission = keyof typeof PERMISSIONS;

export function can(permission: Permission, role: CompanyRole): boolean {
  return PERMISSIONS[permission](role);
}
