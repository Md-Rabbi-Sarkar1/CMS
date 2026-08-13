import type { ReactNode } from "react";

type Tone = "gray" | "blue" | "green" | "amber" | "red" | "purple";

const toneClasses: Record<Tone, string> = {
  gray: "bg-slate-100 text-slate-700",
  blue: "bg-blue-100 text-blue-700",
  green: "bg-green-100 text-green-700",
  amber: "bg-amber-100 text-amber-700",
  red: "bg-red-100 text-red-700",
  purple: "bg-purple-100 text-purple-700",
};

export function Badge({ tone = "gray", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${toneClasses[tone]}`}>
      {children}
    </span>
  );
}

const statusToneMap: Record<string, Tone> = {
  PLANNING: "gray",
  ACTIVE: "blue",
  ON_HOLD: "amber",
  COMPLETED: "green",
  CANCELLED: "red",
  TODO: "gray",
  IN_PROGRESS: "blue",
  BLOCKED: "red",
  REVIEW: "amber",
  PENDING: "amber",
  APPROVED: "green",
  REJECTED: "red",
  OPEN: "gray",
  ASSIGNED: "blue",
  RESOLVED: "green",
  VERIFIED: "purple",
  CLOSED: "gray",
  PURCHASE: "green",
  USAGE: "amber",
  ADJUSTMENT: "blue",
};

export function StatusBadge({ status }: { status: string }) {
  const tone = statusToneMap[status] ?? "gray";
  const label = status.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  return <Badge tone={tone}>{label}</Badge>;
}

const priorityToneMap: Record<string, Tone> = {
  LOW: "gray",
  MEDIUM: "blue",
  HIGH: "amber",
  URGENT: "red",
};

export function PriorityBadge({ priority }: { priority: string }) {
  const tone = priorityToneMap[priority] ?? "gray";
  return <Badge tone={tone}>{priority}</Badge>;
}

const roleToneMap: Record<string, Tone> = {
  ADMIN: "red",
  PROJECT_MANAGER: "blue",
  ENGINEER: "green",
  WORKER: "gray",
};

export function RoleBadge({ role }: { role: string }) {
  const tone = roleToneMap[role] ?? "gray";
  return <Badge tone={tone}>{role.replace(/_/g, " ")}</Badge>;
}
