import { prisma } from "../providers/database.js";
import type { JWTPayload } from "../types/auth.js";

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

export interface ProjectProgressItem {
  id: string;
  name: string;
  status: string;
  progressPercentage: number;
  taskTotal: number;
  taskCompleted: number;
}

export interface AnalyticsResult {
  dashboard: DashboardStats;
  projectProgress: ProjectProgressItem[];
}

export class AnalyticsService {
  async getDashboard(user: JWTPayload): Promise<DashboardStats> {
    const companyId = user.companyId;

    const [projectCounts, taskCounts, issueCounts, expenseAgg, materialCounts] = await Promise.all([
      prisma.project.groupBy({
        by: ["status"],
        where: { companyId },
        _count: { _all: true },
      }),
      prisma.task.groupBy({
        by: ["status"],
        where: { project: { companyId } },
        _count: { _all: true },
      }),
      prisma.issue.groupBy({
        by: ["status"],
        where: { project: { companyId } },
        _count: { _all: true },
      }),
      prisma.expense.groupBy({
        by: ["status"],
        where: { project: { companyId } },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.material.aggregate({
        where: { companyId },
        _count: { _all: true },
      }),
    ]);

    const projectsByStatus = Object.fromEntries(
      projectCounts.map((p) => [p.status, p._count._all]),
    );
    const tasksByStatus = Object.fromEntries(taskCounts.map((t) => [t.status, t._count._all]));
    const issuesByStatus = Object.fromEntries(issueCounts.map((i) => [i.status, i._count._all]));

    const pending = expenseAgg.find((e) => e.status === "PENDING");
    const approved = expenseAgg.find((e) => e.status === "APPROVED");

    const lowStockMaterials = await prisma.material.findMany({
      where: { companyId, reorderLevel: { gt: 0 } },
      select: { currentStock: true, reorderLevel: true },
    });
    const lowStock = lowStockMaterials.filter((m) =>
      m.currentStock.lte(m.reorderLevel),
    ).length;

    return {
      projects: {
        total:
          (projectsByStatus.PLANNING ?? 0) +
          (projectsByStatus.ACTIVE ?? 0) +
          (projectsByStatus.ON_HOLD ?? 0) +
          (projectsByStatus.COMPLETED ?? 0) +
          (projectsByStatus.CANCELLED ?? 0),
        active: projectsByStatus.ACTIVE ?? 0,
        completed: projectsByStatus.COMPLETED ?? 0,
        onHold: projectsByStatus.ON_HOLD ?? 0,
      },
      tasks: {
        total: Object.values(tasksByStatus).reduce((a, b) => a + b, 0),
        todo: tasksByStatus.TODO ?? 0,
        inProgress: tasksByStatus.IN_PROGRESS ?? 0,
        blocked: tasksByStatus.BLOCKED ?? 0,
        completed: tasksByStatus.COMPLETED ?? 0,
      },
      issues: {
        total: Object.values(issuesByStatus).reduce((a, b) => a + b, 0),
        open: issuesByStatus.OPEN ?? 0,
        resolved: issuesByStatus.RESOLVED ?? 0,
      },
      expenses: {
        pendingCount: pending?._count._all ?? 0,
        pendingAmount: (pending?._sum.amount ?? BigInt(0)).toString(),
        approvedAmount: (approved?._sum.amount ?? BigInt(0)).toString(),
      },
      materials: {
        total: materialCounts._count._all,
        lowStock,
      },
    };
  }

  async getProjectProgress(user: JWTPayload): Promise<ProjectProgressItem[]> {
    const projects = await prisma.project.findMany({
      where: { companyId: user.companyId },
      select: {
        id: true,
        name: true,
        status: true,
        progressPercentage: true,
        tasks: { select: { status: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    return projects.map((p) => ({
      id: p.id,
      name: p.name,
      status: p.status,
      progressPercentage: p.progressPercentage,
      taskTotal: p.tasks.length,
      taskCompleted: p.tasks.filter((t) => t.status === "COMPLETED").length,
    }));
  }

  async getAnalytics(user: JWTPayload): Promise<AnalyticsResult> {
    const [dashboard, projectProgress] = await Promise.all([
      this.getDashboard(user),
      this.getProjectProgress(user),
    ]);

    return { dashboard, projectProgress };
  }
}
