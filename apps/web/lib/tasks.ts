import {
  canTransitionTaskStatus,
  type TaskPriority,
  type TaskStatus,
} from "@construction-ops/validation";

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  BLOCKED: "Blocked",
  REVIEW: "Review",
  COMPLETED: "Completed",
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

export const TASK_STATUSES: readonly TaskStatus[] = ["TODO", "IN_PROGRESS", "BLOCKED", "REVIEW", "COMPLETED"];

export function getAvailableTaskStatuses(status: TaskStatus): TaskStatus[] {
  return TASK_STATUSES.filter((candidate) => candidate !== status && canTransitionTaskStatus(status, candidate));
}

export function formatTaskDate(value: string | null): string {
  if (value == null) {
    return "—";
  }

  return value.slice(0, 10);
}

export function toTaskDateInputValue(value: string | null): string {
  return value == null ? "" : value.slice(0, 10);
}
