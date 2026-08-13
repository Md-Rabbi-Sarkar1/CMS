// Frontend domain types mirroring the API response shapes.

export interface Company {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: CompanyRole;
  companyId: string;
  company?: Company;
  status?: string;
}

export interface Invitation {
  id: string;
  email: string;
  role: CompanyRole;
  status: string;
  expiresAt: string;
  createdAt: string;
  acceptedAt?: string | null;
  token?: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  clientInfo: string | null;
  startDate: string | null;
  expectedEndDate: string | null;
  actualEndDate: string | null;
  budget: string | null;
  status: string;
  progressPercentage: number;
  managerId: string | null;
  manager: { id: string; name: string; email: string } | null;
  taskCount: number;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMember {
  id: string;
  userId: string;
  assignedAt: string;
  user: { id: string; name: string; email: string; role: CompanyRole };
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  projectId: string;
  assigneeId: string | null;
  assignee: { id: string; name: string; email: string } | null;
  priority: string;
  status: string;
  startDate: string | null;
  dueDate: string | null;
  completionDate: string | null;
  createdAt: string;
  updatedAt: string;
  project?: { id: string; name: string };
}

export interface ReportWorker {
  id: string;
  name: string;
  role: string | null;
  hoursWorked: number | null;
}

export interface DailyWorkReport {
  id: string;
  projectId: string;
  submittedById: string;
  reportDate: string;
  workCompleted: string;
  hoursWorked: string;
  materialsUsed: string | null;
  progressPct: number;
  problemsEncountered: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  project: { id: string; name: string };
  submittedBy: { id: string; name: string; email: string };
  workers: ReportWorker[];
}

export interface Material {
  id: string;
  name: string;
  unit: string;
  currentStock: string;
  reorderLevel: string;
  lowStock: boolean;
  transactionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryTransaction {
  id: string;
  materialId: string;
  type: string;
  quantity: string;
  note: string | null;
  projectId: string | null;
  performedById: string;
  createdAt: string;
  material: { id: string; name: string; unit: string };
}

export interface Expense {
  id: string;
  projectId: string | null;
  submittedById: string;
  reviewedById: string | null;
  category: string;
  amount: string;
  description: string;
  expenseDate: string;
  status: string;
  rejectionReason: string | null;
  reviewedAt: string | null;
  project: { id: string; name: string } | null;
  submittedBy: { id: string; name: string; email: string };
  reviewedBy: { id: string; name: string; email: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface Issue {
  id: string;
  projectId: string;
  reporterId: string;
  assigneeId: string | null;
  title: string;
  description: string;
  location: string | null;
  priority: string;
  status: string;
  resolution: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  project: { id: string; name: string };
  reporter: { id: string; name: string; email: string };
  assignee: { id: string; name: string; email: string } | null;
}

export interface Document {
  id: string;
  projectId: string;
  uploadedById: string;
  name: string;
  type: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string | null;
  project: { id: string; name: string };
  uploadedBy: { id: string; name: string; email: string };
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
}

export interface DashboardStats {
  projects: {
    total: number;
    active: number;
    completed: number;
    onHold: number;
  };
  tasks: {
    total: number;
    todo: number;
    inProgress: number;
    blocked: number;
    completed: number;
  };
  issues: {
    total: number;
    open: number;
    resolved: number;
  };
  expenses: {
    pendingCount: number;
    pendingAmount: string;
    approvedAmount: string;
  };
  materials: {
    total: number;
    lowStock: number;
  };
}

export interface ProjectProgress {
  id: string;
  name: string;
  status: string;
  progressPercentage: number;
  taskTotal: number;
  taskCompleted: number;
}

import type { CompanyRole } from "@construction-ops/shared";

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
