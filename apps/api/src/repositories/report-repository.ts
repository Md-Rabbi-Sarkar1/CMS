import type { Prisma, PrismaClient } from "@construction-ops/database";

import { prisma } from "../providers/database.js";

export interface ReportWorkerInput {
  name: string;
  role?: string | undefined;
  hoursWorked?: number | undefined;
}

export interface CreateReportData {
  projectId: string;
  submittedById: string;
  reportDate: Date;
  workCompleted: string;
  hoursWorked: number;
  materialsUsed?: string | undefined;
  progressPct: number;
  problemsEncountered?: string | undefined;
  notes?: string | undefined;
  workers: ReportWorkerInput[];
}

export interface UpdateReportData {
  reportDate?: Date | undefined;
  workCompleted?: string | undefined;
  hoursWorked?: number | undefined;
  materialsUsed?: string | undefined;
  progressPct?: number | undefined;
  problemsEncountered?: string | undefined;
  notes?: string | undefined;
  workers?: ReportWorkerInput[] | undefined;
}

export interface ReportListFilters {
  page: number;
  pageSize: number;
  companyId: string;
  projectId?: string;
  submittedById?: string;
  reportDateFrom?: Date;
  reportDateTo?: Date;
}

export interface ReportListResult {
  items: ReportWithRelations[];
  total: number;
  page: number;
  pageSize: number;
}

const reportInclude = {
  workers: {
    orderBy: { createdAt: "asc" as const },
  },
  project: {
    select: { id: true, name: true },
  },
  submittedBy: {
    select: { id: true, name: true, email: true },
  },
} satisfies Prisma.DailyWorkReportInclude;

export type ReportWithRelations = Prisma.DailyWorkReportGetPayload<{
  include: typeof reportInclude;
}>;

function toWorkerCreateMany(reportId: string, workers: ReportWorkerInput[]) {
  return workers.map((worker) => ({
    reportId,
    name: worker.name,
    role: worker.role ?? null,
    hoursWorked: worker.hoursWorked ?? null,
  }));
}

export class ReportRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  async create(data: CreateReportData): Promise<ReportWithRelations> {
    const { workers, submittedById, projectId, reportDate, materialsUsed, problemsEncountered, notes, ...rest } = data;

    return this.client.dailyWorkReport.create({
      data: {
        ...rest,
        reportDate,
        materialsUsed: materialsUsed ?? null,
        problemsEncountered: problemsEncountered ?? null,
        notes: notes ?? null,
        submittedBy: { connect: { id: submittedById } },
        project: { connect: { id: projectId } },
        workers: {
          create: workers.map((worker) => ({
            name: worker.name,
            role: worker.role ?? null,
            hoursWorked: worker.hoursWorked ?? null,
          })),
        },
      },
      include: reportInclude,
    });
  }

  async findById(id: string): Promise<ReportWithRelations | null> {
    return this.client.dailyWorkReport.findUnique({
      where: { id },
      include: reportInclude,
    });
  }

  async findOwnedById(id: string, companyId: string): Promise<ReportWithRelations | null> {
    const report = await this.client.dailyWorkReport.findUnique({
      where: { id },
      include: reportInclude,
    });

    if (!report) {
      return null;
    }

    const owner = await this.client.project.findUnique({
      where: { id: report.projectId },
      select: { companyId: true },
    });

    if (owner?.companyId !== companyId) {
      return null;
    }

    return report;
  }

  async list(filters: ReportListFilters): Promise<ReportListResult> {
    const { page, pageSize, companyId, projectId, submittedById, reportDateFrom, reportDateTo } = filters;

    const where: Prisma.DailyWorkReportWhereInput = {
      project: { companyId },
    };

    if (projectId !== undefined) {
      where.projectId = projectId;
    }
    if (submittedById !== undefined) {
      where.submittedById = submittedById;
    }
    if (reportDateFrom !== undefined || reportDateTo !== undefined) {
      where.reportDate = {};
      if (reportDateFrom !== undefined) {
        where.reportDate.gte = reportDateFrom;
      }
      if (reportDateTo !== undefined) {
        where.reportDate.lte = reportDateTo;
      }
    }

    const [items, total] = await this.client.$transaction([
      this.client.dailyWorkReport.findMany({
        where,
        include: reportInclude,
        orderBy: { reportDate: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.client.dailyWorkReport.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  /**
   * Atomically replaces the worker set of a report inside a single transaction.
   * Existing ReportWorker rows for the report are deleted and the new set is
   * inserted, so the final worker set is exactly the provided list.
   */
  async updateOwned(
    id: string,
    companyId: string,
    data: UpdateReportData,
  ): Promise<ReportWithRelations | null> {
    const existing = await this.findOwnedById(id, companyId);

    if (!existing) {
      return null;
    }

    const { workers, reportDate, materialsUsed, problemsEncountered, notes, workCompleted, hoursWorked, progressPct } = data;

    if (workers !== undefined) {
      // Atomic worker replacement: delete-all + insert-all in one transaction.
      await this.client.$transaction(async (tx) => {
        await tx.reportWorker.deleteMany({ where: { reportId: id } });
        if (workers.length > 0) {
          await tx.reportWorker.createMany({
            data: toWorkerCreateMany(id, workers),
          });
        }
      });
    }

    const scalarUpdate: Prisma.DailyWorkReportUpdateInput = {};
    if (reportDate !== undefined) {
      scalarUpdate.reportDate = reportDate;
    }
    if (workCompleted !== undefined) {
      scalarUpdate.workCompleted = workCompleted;
    }
    if (hoursWorked !== undefined) {
      scalarUpdate.hoursWorked = hoursWorked;
    }
    if (progressPct !== undefined) {
      scalarUpdate.progressPct = progressPct;
    }
    if (materialsUsed !== undefined) {
      scalarUpdate.materialsUsed = materialsUsed;
    }
    if (problemsEncountered !== undefined) {
      scalarUpdate.problemsEncountered = problemsEncountered;
    }
    if (notes !== undefined) {
      scalarUpdate.notes = notes;
    }

    return this.client.dailyWorkReport.update({
      where: { id },
      data: scalarUpdate,
      include: reportInclude,
    });
  }

  async deleteOwned(id: string, companyId: string): Promise<boolean> {
    const existing = await this.findOwnedById(id, companyId);

    if (!existing) {
      return false;
    }

    await this.client.dailyWorkReport.delete({ where: { id } });
    return true;
  }
}

export const reportIncludeFields = reportInclude;
