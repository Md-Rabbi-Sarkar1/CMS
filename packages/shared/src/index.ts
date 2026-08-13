export const COMPANY_ROLES = ["ADMIN", "PROJECT_MANAGER", "ENGINEER", "WORKER"] as const;
export type CompanyRole = (typeof COMPANY_ROLES)[number];

export const PROJECT_STATUSES = [
  "PLANNING",
  "ACTIVE",
  "ON_HOLD",
  "COMPLETED",
  "CANCELLED",
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const TASK_STATUSES = ["TODO", "IN_PROGRESS", "BLOCKED", "REVIEW", "COMPLETED"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const EXPENSE_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];

export const EXPENSE_CATEGORIES = [
  "MATERIALS",
  "LABOR",
  "TRANSPORTATION",
  "EQUIPMENT",
  "OTHER",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const ISSUE_STATUSES = [
  "OPEN",
  "ASSIGNED",
  "IN_PROGRESS",
  "RESOLVED",
  "VERIFIED",
  "CLOSED",
] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

export const INVENTORY_TX_TYPES = ["PURCHASE", "USAGE", "ADJUSTMENT"] as const;
export type InventoryTxType = (typeof INVENTORY_TX_TYPES)[number];

export const NOTIFICATION_TYPES = [
  "TASK_ASSIGNED",
  "TASK_DEADLINE",
  "REPORT_SUBMITTED",
  "ISSUE_CREATED",
  "EXPENSE_PENDING",
  "LOW_STOCK",
  "PROJECT_ASSIGNMENT",
  "DOCUMENT_UPLOADED",
  "INVITATION_ACCEPTED",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    page: number;
    pageSize: number;
    total: number;
  };
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: { field: string; message: string }[];
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
