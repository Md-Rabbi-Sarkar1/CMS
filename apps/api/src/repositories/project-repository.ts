import type { Prisma, PrismaClient, ProjectStatus } from "@construction-ops/database";

import { prisma } from "../providers/database.js";

export interface ProjectListFilters {
  companyId: string;
  page: number;
  pageSize: number;
  status?: ProjectStatus | undefined;
  managerId?: string | undefined;
}

export interface ProjectListResult {
  items: ProjectRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateProjectData {
  companyId: string;
  name: string;
  description?: string;
  location?: string;
  clientInfo?: string;
  startDate?: Date;
  expectedEndDate?: Date;
  budget?: number;
  managerId?: string;
}

export interface UpdateProjectData {
  name?: string;
  description?: string;
  location?: string;
  clientInfo?: string;
  startDate?: Date;
  expectedEndDate?: Date;
  actualEndDate?: Date;
  budget?: number;
  status?: ProjectStatus;
  progressPercentage?: number;
  managerId?: string | null;
}

export type ProjectRow = Prisma.ProjectGetPayload<{
  include: {
    manager: { select: { id: true; name: true; email: true } };
    _count: { select: { tasks: true; members: true } };
  };
}>;

const projectInclude = {
  manager: { select: { id: true, name: true, email: true } },
  _count: { select: { tasks: true, members: true } },
} satisfies Prisma.ProjectInclude;

export class ProjectRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  async list(filters: ProjectListFilters): Promise<ProjectListResult> {
    const where: Prisma.ProjectWhereInput = { companyId: filters.companyId };
    if (filters.status !== undefined) {
      where.status = filters.status;
    }
    if (filters.managerId !== undefined) {
      where.managerId = filters.managerId;
    }

    const [items, total] = await this.client.$transaction([
      this.client.project.findMany({
        where,
        include: projectInclude,
        orderBy: { createdAt: "desc" },
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
      }),
      this.client.project.count({ where }),
    ]);

    return { items, total, page: filters.page, pageSize: filters.pageSize };
  }

  findOwnedById(id: string, companyId: string): Promise<ProjectRow | null> {
    return this.client.project.findFirst({
      where: { id, companyId },
      include: projectInclude,
    });
  }

  create(data: CreateProjectData): Promise<ProjectRow> {
    const createData: Prisma.ProjectCreateInput = {
      company: { connect: { id: data.companyId } },
      name: data.name,
    };
    if (data.description !== undefined) createData.description = data.description;
    if (data.location !== undefined) createData.location = data.location;
    if (data.clientInfo !== undefined) createData.clientInfo = data.clientInfo;
    if (data.startDate !== undefined) createData.startDate = data.startDate;
    if (data.expectedEndDate !== undefined) createData.expectedEndDate = data.expectedEndDate;
    if (data.budget !== undefined) createData.budget = data.budget;
    if (data.managerId !== undefined) {
      createData.manager = { connect: { id: data.managerId } };
    }

    return this.client.project.create({
      data: createData,
      include: projectInclude,
    });
  }

  update(id: string, data: UpdateProjectData): Promise<ProjectRow> {
    const updateData: Prisma.ProjectUpdateInput = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.location !== undefined) updateData.location = data.location;
    if (data.clientInfo !== undefined) updateData.clientInfo = data.clientInfo;
    if (data.startDate !== undefined) updateData.startDate = data.startDate;
    if (data.expectedEndDate !== undefined) updateData.expectedEndDate = data.expectedEndDate;
    if (data.actualEndDate !== undefined) updateData.actualEndDate = data.actualEndDate;
    if (data.budget !== undefined) updateData.budget = data.budget;
    if (data.status !== undefined) {
      updateData.status = data.status;
    }
    if (data.progressPercentage !== undefined) updateData.progressPercentage = data.progressPercentage;
    if (data.managerId !== undefined) {
      updateData.manager = data.managerId === null ? { disconnect: true } : { connect: { id: data.managerId } };
    }

    return this.client.project.update({
      where: { id },
      data: updateData,
      include: projectInclude,
    });
  }

  delete(id: string): Promise<void> {
    return this.client.project.delete({ where: { id } }).then(() => undefined);
  }
}
