import type { Prisma, PrismaClient, IssueStatus, TaskPriority } from "@construction-ops/database";

import { prisma } from "../providers/database.js";

export interface IssueListFilters {
  companyId: string;
  page: number;
  pageSize: number;
  projectId?: string | undefined;
  status?: IssueStatus | undefined;
  assigneeId?: string | undefined;
}

export interface IssueListResult {
  items: IssueRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateIssueData {
  projectId: string;
  reporterId: string;
  assigneeId?: string;
  title: string;
  description: string;
  location?: string;
  priority?: TaskPriority;
}

export interface UpdateIssueData {
  assigneeId?: string | null;
  priority?: TaskPriority;
  status?: IssueStatus;
  resolution?: string;
  location?: string;
}

export type IssueRow = Prisma.IssueGetPayload<{
  include: {
    project: { select: { id: true; name: true } };
    reporter: { select: { id: true; name: true; email: true } };
    assignee: { select: { id: true; name: true; email: true } };
  };
}>;

const issueInclude = {
  project: { select: { id: true, name: true } },
  reporter: { select: { id: true, name: true, email: true } },
  assignee: { select: { id: true, name: true, email: true } },
} satisfies Prisma.IssueInclude;

export class IssueRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  async list(filters: IssueListFilters): Promise<IssueListResult> {
    const where: Prisma.IssueWhereInput = { project: { companyId: filters.companyId } };
    if (filters.projectId !== undefined) where.projectId = filters.projectId;
    if (filters.status !== undefined) where.status = filters.status;
    if (filters.assigneeId !== undefined) where.assigneeId = filters.assigneeId;

    const [items, total] = await this.client.$transaction([
      this.client.issue.findMany({
        where,
        include: issueInclude,
        orderBy: { createdAt: "desc" },
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
      }),
      this.client.issue.count({ where }),
    ]);

    return { items, total, page: filters.page, pageSize: filters.pageSize };
  }

  findOwnedById(id: string, companyId: string): Promise<IssueRow | null> {
    return this.client.issue.findFirst({
      where: { id, project: { companyId } },
      include: issueInclude,
    });
  }

  create(data: CreateIssueData): Promise<IssueRow> {
    const createData: Prisma.IssueCreateInput = {
      project: { connect: { id: data.projectId } },
      reporter: { connect: { id: data.reporterId } },
      title: data.title,
      description: data.description,
    };
    if (data.assigneeId !== undefined) createData.assignee = { connect: { id: data.assigneeId } };
    if (data.location !== undefined) createData.location = data.location;
    if (data.priority !== undefined) createData.priority = data.priority;

    return this.client.issue.create({ data: createData, include: issueInclude });
  }

  update(id: string, data: UpdateIssueData): Promise<IssueRow> {
    const updateData: Prisma.IssueUpdateInput = {};
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.resolution !== undefined) updateData.resolution = data.resolution;
    if (data.location !== undefined) updateData.location = data.location;
    if (data.assigneeId !== undefined) {
      updateData.assignee = data.assigneeId === null ? { disconnect: true } : { connect: { id: data.assigneeId } };
    }
    if (data.status === "RESOLVED") {
      updateData.resolvedAt = new Date();
    }

    return this.client.issue.update({ where: { id }, data: updateData, include: issueInclude });
  }

  delete(id: string): Promise<void> {
    return this.client.issue.delete({ where: { id } }).then(() => undefined);
  }
}
