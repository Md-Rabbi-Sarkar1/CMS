import type { CreateIssueInput, UpdateIssueInput } from "@construction-ops/validation";
import { ISSUE_STATUS_TRANSITIONS } from "@construction-ops/validation";
import type { IssueStatus } from "@construction-ops/database";

import { prisma } from "../providers/database.js";
import {
  IssueRepository,
  type IssueListFilters,
  type IssueRow,
  type CreateIssueData,
  type UpdateIssueData,
} from "../repositories/issue-repository.js";
import { NotificationEventService } from "./notification-event-service.js";
import { ConflictError, NotFoundError } from "../utils/errors.js";
import type { JWTPayload } from "../types/auth.js";

export interface IssueResponse {
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
  project: { id: string; name: string };
  reporter: { id: string; name: string; email: string };
  assignee: { id: string; name: string; email: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface IssueListResponse {
  items: IssueResponse[];
  total: number;
  page: number;
  pageSize: number;
}

function toResponse(issue: IssueRow): IssueResponse {
  return {
    id: issue.id,
    projectId: issue.projectId,
    reporterId: issue.reporterId,
    assigneeId: issue.assigneeId,
    title: issue.title,
    description: issue.description,
    location: issue.location,
    priority: issue.priority,
    status: issue.status,
    resolution: issue.resolution,
    resolvedAt: issue.resolvedAt ? issue.resolvedAt.toISOString() : null,
    project: { id: issue.project.id, name: issue.project.name },
    reporter: { id: issue.reporter.id, name: issue.reporter.name, email: issue.reporter.email },
    assignee: issue.assignee
      ? { id: issue.assignee.id, name: issue.assignee.name, email: issue.assignee.email }
      : null,
    createdAt: issue.createdAt.toISOString(),
    updatedAt: issue.updatedAt.toISOString(),
  };
}

async function assertProjectAccess(user: JWTPayload, projectId: string): Promise<void> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, companyId: user.companyId },
    select: { id: true, managerId: true },
  });

  if (!project) {
    throw new NotFoundError("Project not found");
  }

  if (user.role === "ADMIN") return;
  if (project.managerId === user.sub) return;

  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: user.sub } },
    select: { id: true },
  });

  if (!membership) {
    throw new NotFoundError("Project not found");
  }
}

export class IssueService {
  private readonly issueRepository: IssueRepository;
  private readonly notificationEvents: NotificationEventService;

  constructor(
    issueRepository: IssueRepository = new IssueRepository(),
    notificationEvents: NotificationEventService = new NotificationEventService(),
  ) {
    this.issueRepository = issueRepository;
    this.notificationEvents = notificationEvents;
  }

  async create(user: JWTPayload, payload: CreateIssueInput): Promise<IssueResponse> {
    await assertProjectAccess(user, payload.projectId);

    if (payload.assigneeId !== undefined) {
      const assignee = await prisma.user.findFirst({
        where: { id: payload.assigneeId, companyId: user.companyId },
        select: { id: true },
      });
      if (!assignee) {
        throw new NotFoundError("Assignee not found");
      }
    }

    const data: CreateIssueData = {
      projectId: payload.projectId,
      reporterId: user.sub,
      title: payload.title,
      description: payload.description,
    };
    if (payload.assigneeId !== undefined) data.assigneeId = payload.assigneeId;
    if (payload.location !== undefined) data.location = payload.location;
    if (payload.priority !== undefined) data.priority = payload.priority;

    const issue = await this.issueRepository.create(data);

    await this.notificationEvents.issueCreated({
      companyId: user.companyId,
      projectId: issue.projectId,
      actorId: user.sub,
      projectName: issue.project.name,
      reporterName: issue.reporter.name,
      issueTitle: issue.title,
      assigneeId: issue.assigneeId,
    });

    return toResponse(issue);
  }

  async list(
    user: JWTPayload,
    query: {
      page: number;
      pageSize: number;
      projectId?: string | undefined;
      status?: IssueStatus | undefined;
      assigneeId?: string | undefined;
    },
  ): Promise<IssueListResponse> {
    const filters: IssueListFilters = {
      companyId: user.companyId,
      page: query.page,
      pageSize: query.pageSize,
    };
    if (query.projectId !== undefined) filters.projectId = query.projectId;
    if (query.status !== undefined) filters.status = query.status;
    if (query.assigneeId !== undefined) filters.assigneeId = query.assigneeId;

    const result = await this.issueRepository.list(filters);
    return {
      items: result.items.map(toResponse),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    };
  }

  async getById(user: JWTPayload, id: string): Promise<IssueResponse> {
    const issue = await this.issueRepository.findOwnedById(id, user.companyId);
    if (!issue) {
      throw new NotFoundError("Issue not found");
    }
    return toResponse(issue);
  }

  async update(user: JWTPayload, id: string, payload: UpdateIssueInput): Promise<IssueResponse> {
    const issue = await this.issueRepository.findOwnedById(id, user.companyId);
    if (!issue) {
      throw new NotFoundError("Issue not found");
    }

    if (payload.assigneeId !== undefined && payload.assigneeId !== null) {
      const assignee = await prisma.user.findFirst({
        where: { id: payload.assigneeId, companyId: user.companyId },
        select: { id: true },
      });
      if (!assignee) {
        throw new NotFoundError("Assignee not found");
      }
    }

    await assertProjectAccess(user, issue.projectId);

    if (payload.status !== undefined && payload.status !== issue.status) {
      const allowed = ISSUE_STATUS_TRANSITIONS[issue.status] ?? [];
      if (!allowed.includes(payload.status)) {
        throw new ConflictError(
          `Invalid status transition from ${issue.status} to ${payload.status}`,
        );
      }
    }

    const data: UpdateIssueData = {};
    if (payload.assigneeId !== undefined) data.assigneeId = payload.assigneeId;
    if (payload.priority !== undefined) data.priority = payload.priority;
    if (payload.status !== undefined) data.status = payload.status;
    if (payload.resolution !== undefined) data.resolution = payload.resolution;
    if (payload.location !== undefined) data.location = payload.location;

    const updated = await this.issueRepository.update(id, data);
    return toResponse(updated);
  }

  async delete(user: JWTPayload, id: string): Promise<void> {
    const issue = await this.issueRepository.findOwnedById(id, user.companyId);
    if (!issue) {
      throw new NotFoundError("Issue not found");
    }

    await assertProjectAccess(user, issue.projectId);

    await this.issueRepository.delete(id);
  }
}
