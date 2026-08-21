import type { DailyWorkReport } from "@construction-ops/database";
import type {
  CreateDailyWorkReportInput,
  ReportListQuery,
  UpdateDailyWorkReportInput,
} from "@construction-ops/validation";

import { prisma } from "../providers/database.js";
import {
  ReportRepository,
  type ReportWithRelations,
  type CreateReportData,
  type UpdateReportData,
  type ReportListFilters,
} from "../repositories/report-repository.js";
import { NotificationEventService } from "./notification-event-service.js";
import { NotFoundError, ForbiddenError } from "../utils/errors.js";
import type { CompanyRole, JWTPayload } from "../types/auth.js";

export interface ReportWorkerResponse {
  id: string;
  name: string;
  role: string | null;
  hoursWorked: number | null;
}

export interface ReportResponse {
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
  workers: ReportWorkerResponse[];
  project: { id: string; name: string };
  submittedBy: { id: string; name: string; email: string };
}

export interface ReportListResponse {
  items: ReportResponse[];
  total: number;
  page: number;
  pageSize: number;
}

export type CreateReportPayload = CreateDailyWorkReportInput;
export type UpdateReportPayload = UpdateDailyWorkReportInput;
export type ReportListQueryPayload = ReportListQuery;

const SUBMITTER_ROLES: ReadonlySet<CompanyRole> = new Set(["ADMIN", "PROJECT_MANAGER", "ENGINEER", "WORKER"]);

function canManageReport(user: JWTPayload, report: ReportWithRelations): boolean {
  if (user.role === "ADMIN" || user.role === "PROJECT_MANAGER") {
    return true;
  }
  return report.submittedById === user.sub;
}

function toWorkerResponse(workers: ReportWithRelations["workers"]): ReportWorkerResponse[] {
  return workers.map((worker) => ({
    id: worker.id,
    name: worker.name,
    role: worker.role,
    hoursWorked: worker.hoursWorked === null ? null : Number(worker.hoursWorked),
  }));
}

export function toReportResponse(report: ReportWithRelations): ReportResponse {
  return {
    id: report.id,
    projectId: report.projectId,
    submittedById: report.submittedById,
    reportDate: report.reportDate.toISOString().slice(0, 10),
    workCompleted: report.workCompleted,
    hoursWorked: report.hoursWorked.toString(),
    materialsUsed: report.materialsUsed,
    progressPct: report.progressPct,
    problemsEncountered: report.problemsEncountered,
    notes: report.notes,
    createdAt: report.createdAt.toISOString(),
    updatedAt: report.updatedAt.toISOString(),
    workers: toWorkerResponse(report.workers),
    project: {
      id: report.project.id,
      name: report.project.name,
    },
    submittedBy: {
      id: report.submittedBy.id,
      name: report.submittedBy.name,
      email: report.submittedBy.email,
    },
  };
}

function parseDate(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new NotFoundError("Invalid date");
  }
  return date;
}

export class ReportService {
  private readonly reportRepository: ReportRepository;
  private readonly notificationEvents: NotificationEventService;

  constructor(
    reportRepository: ReportRepository = new ReportRepository(),
    notificationEvents: NotificationEventService = new NotificationEventService(),
  ) {
    this.reportRepository = reportRepository;
    this.notificationEvents = notificationEvents;
  }

  async create(user: JWTPayload, payload: CreateReportPayload): Promise<ReportResponse> {
    if (!SUBMITTER_ROLES.has(user.role)) {
      throw new ForbiddenError("You are not allowed to create daily work reports");
    }

    const project = await prisma.project.findUnique({
      where: { id: payload.projectId },
      select: { companyId: true, id: true },
    });

    if (project?.companyId !== user.companyId) {
      throw new NotFoundError("Project not found");
    }

    const data: CreateReportData = {
      projectId: payload.projectId,
      submittedById: user.sub,
      reportDate: parseDate(payload.reportDate),
      workCompleted: payload.workCompleted,
      hoursWorked: payload.hoursWorked,
      progressPct: payload.progressPct,
      workers: payload.workers,
    };

    if (payload.materialsUsed !== undefined) {
      data.materialsUsed = payload.materialsUsed;
    }
    if (payload.problemsEncountered !== undefined) {
      data.problemsEncountered = payload.problemsEncountered;
    }
    if (payload.notes !== undefined) {
      data.notes = payload.notes;
    }

    const report = await this.reportRepository.create(data);

    await this.notificationEvents.reportSubmitted({
      companyId: user.companyId,
      projectId: report.projectId,
      actorId: user.sub,
      projectName: report.project.name,
      submitterName: report.submittedBy.name,
    });

    return toReportResponse(report);
  }

  async list(user: JWTPayload, query: ReportListQueryPayload): Promise<ReportListResponse> {
    const filters: ReportListFilters = {
      page: query.page,
      pageSize: query.pageSize,
      companyId: user.companyId,
    };

    if (query.projectId !== undefined) {
      filters.projectId = query.projectId;
    }
    if (query.submittedById !== undefined) {
      filters.submittedById = query.submittedById;
    }
    if (query.reportDateFrom !== undefined) {
      filters.reportDateFrom = parseDate(query.reportDateFrom);
    }
    if (query.reportDateTo !== undefined) {
      filters.reportDateTo = parseDate(query.reportDateTo);
    }

    const result = await this.reportRepository.list(filters);

    return {
      items: result.items.map(toReportResponse),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    };
  }

  async getById(user: JWTPayload, id: string): Promise<ReportResponse> {
    const report = await this.reportRepository.findOwnedById(id, user.companyId);

    if (!report) {
      throw new NotFoundError("Daily work report not found");
    }

    return toReportResponse(report);
  }

  async update(user: JWTPayload, id: string, payload: UpdateReportPayload): Promise<ReportResponse> {
    const existing = await this.reportRepository.findOwnedById(id, user.companyId);

    if (!existing) {
      throw new NotFoundError("Daily work report not found");
    }

    if (!canManageReport(user, existing)) {
      throw new ForbiddenError("You are not allowed to update this daily work report");
    }

    const data: UpdateReportData = {};

    if (payload.reportDate !== undefined) {
      data.reportDate = parseDate(payload.reportDate);
    }
    if (payload.workCompleted !== undefined) {
      data.workCompleted = payload.workCompleted;
    }
    if (payload.hoursWorked !== undefined) {
      data.hoursWorked = payload.hoursWorked;
    }
    if (payload.materialsUsed !== undefined) {
      data.materialsUsed = payload.materialsUsed;
    }
    if (payload.progressPct !== undefined) {
      data.progressPct = payload.progressPct;
    }
    if (payload.problemsEncountered !== undefined) {
      data.problemsEncountered = payload.problemsEncountered;
    }
    if (payload.notes !== undefined) {
      data.notes = payload.notes;
    }
    if (payload.workers !== undefined) {
      data.workers = payload.workers;
    }

    const updated = await this.reportRepository.updateOwned(id, user.companyId, data);

    if (!updated) {
      throw new NotFoundError("Daily work report not found");
    }

    return toReportResponse(updated);
  }

  async delete(user: JWTPayload, id: string): Promise<void> {
    const existing = await this.reportRepository.findOwnedById(id, user.companyId);

    if (!existing) {
      throw new NotFoundError("Daily work report not found");
    }

    if (!canManageReport(user, existing)) {
      throw new ForbiddenError("You are not allowed to delete this daily work report");
    }

    await this.reportRepository.deleteOwned(id, user.companyId);
  }
}

export type { DailyWorkReport };
