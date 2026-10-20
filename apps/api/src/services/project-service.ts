import type { CreateProjectInput, UpdateProjectInput } from "@construction-ops/validation";
import {
  PROJECT_STATUS_TRANSITIONS,
} from "@construction-ops/validation";
import type { ProjectStatus } from "@construction-ops/database";

import { prisma } from "../providers/database.js";
import {
  ProjectRepository,
  type ProjectListFilters,
  type ProjectRow,
  type CreateProjectData,
  type UpdateProjectData,
} from "../repositories/project-repository.js";
import { ConflictError, ForbiddenError, NotFoundError } from "../utils/errors.js";
import type { CompanyRole, JWTPayload } from "../types/auth.js";

export interface ProjectResponse {
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

export interface ProjectListResponse {
  items: ProjectResponse[];
  total: number;
  page: number;
  pageSize: number;
}

const PROJECT_CREATORS: ReadonlySet<CompanyRole> = new Set(["ADMIN", "PROJECT_MANAGER"]);

function parseDate(value: string): Date {
  return new Date(value);
}

function toResponse(project: ProjectRow): ProjectResponse {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    location: project.location,
    clientInfo: project.clientInfo,
    startDate: project.startDate ? project.startDate.toISOString().slice(0, 10) : null,
    expectedEndDate: project.expectedEndDate ? project.expectedEndDate.toISOString().slice(0, 10) : null,
    actualEndDate: project.actualEndDate ? project.actualEndDate.toISOString().slice(0, 10) : null,
    budget: project.budget ? project.budget.toString() : null,
    status: project.status,
    progressPercentage: project.progressPercentage,
    managerId: project.managerId,
    manager: project.manager ? { id: project.manager.id, name: project.manager.name, email: project.manager.email } : null,
    taskCount: project._count.tasks,
    memberCount: project._count.members,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

export class ProjectService {
  private readonly projectRepository: ProjectRepository;

  constructor(projectRepository: ProjectRepository = new ProjectRepository()) {
    this.projectRepository = projectRepository;
  }

  async create(user: JWTPayload, payload: CreateProjectInput): Promise<ProjectResponse> {
    if (!PROJECT_CREATORS.has(user.role)) {
      throw new ForbiddenError("You are not allowed to create projects");
    }

    const managerId = payload.managerId ?? (user.role === "PROJECT_MANAGER" ? user.sub : undefined);

    if (managerId !== undefined) {
      const manager = await prisma.user.findFirst({
        where: { id: managerId, companyId: user.companyId, role: "PROJECT_MANAGER" },
        select: { id: true },
      });
      if (!manager) {
        throw new NotFoundError("Project manager not found");
      }
    }

    const data: CreateProjectData = {
      companyId: user.companyId,
      name: payload.name,
    };
    if (payload.description !== undefined) data.description = payload.description;
    if (payload.location !== undefined) data.location = payload.location;
    if (payload.clientInfo !== undefined) data.clientInfo = payload.clientInfo;
    if (payload.startDate !== undefined) data.startDate = parseDate(payload.startDate);
    if (payload.expectedEndDate !== undefined) data.expectedEndDate = parseDate(payload.expectedEndDate);
    if (payload.budget !== undefined) data.budget = payload.budget;
    if (managerId !== undefined) data.managerId = managerId;

    const project = await this.projectRepository.create(data);
    if (managerId !== undefined) {
      await prisma.projectMember.create({ data: { projectId: project.id, userId: managerId } });
    }
    return toResponse(project);
  }

  async list(
    user: JWTPayload,
    query: { page: number; pageSize: number; status?: ProjectStatus | undefined; managerId?: string | undefined },
  ): Promise<ProjectListResponse> {
    const filters: ProjectListFilters = {
      companyId: user.companyId,
      page: query.page,
      pageSize: query.pageSize,
    };
    if (query.status !== undefined) filters.status = query.status;
    if (query.managerId !== undefined) filters.managerId = query.managerId;

    // Non-admins only see projects they are members of (or manage).
    if (user.role !== "ADMIN") {
      return this.listForMember(user, query);
    }

    const result = await this.projectRepository.list(filters);
    return {
      items: result.items.map(toResponse),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    };
  }

  private async listForMember(
    user: JWTPayload,
    query: { page: number; pageSize: number; status?: ProjectStatus | undefined; managerId?: string | undefined },
  ): Promise<ProjectListResponse> {
    const where = {
      companyId: user.companyId,
      ...(query.status === undefined ? {} : { status: query.status }),
      ...(query.managerId === undefined ? {} : { managerId: query.managerId }),
      OR: [{ managerId: user.sub }, { members: { some: { userId: user.sub } } }],
    };
    const memberships = await prisma.projectMember.findMany({
      where: { project: where },
      select: { project: { include: { manager: { select: { id: true, name: true, email: true } }, _count: { select: { tasks: true, members: true } } } } },
      orderBy: { project: { createdAt: "desc" } },
    });

    const managedOnly = await prisma.project.findMany({
      where: { ...where, managerId: user.sub, members: { none: { userId: user.sub } } },
      include: { manager: { select: { id: true, name: true, email: true } }, _count: { select: { tasks: true, members: true } } },
      orderBy: { createdAt: "desc" },
    });
    const seen = new Set(memberships.map((membership) => membership.project.id));
    const items = [
      ...memberships.map((membership) => toResponse(membership.project)),
      ...managedOnly.filter((project) => !seen.has(project.id)).map(toResponse),
    ];
    const start = (query.page - 1) * query.pageSize;
    return { items: items.slice(start, start + query.pageSize), total: items.length, page: query.page, pageSize: query.pageSize };
  }

  async getById(user: JWTPayload, id: string): Promise<ProjectResponse> {
    const project = await this.projectRepository.findOwnedById(id, user.companyId);

    if (!project) {
      throw new NotFoundError("Project not found");
    }

    await this.assertAccess(user, project);

    return toResponse(project);
  }

  async update(user: JWTPayload, id: string, payload: UpdateProjectInput): Promise<ProjectResponse> {
    const project = await this.projectRepository.findOwnedById(id, user.companyId);

    if (!project) {
      throw new NotFoundError("Project not found");
    }

    await this.assertAccess(user, project);

    if (user.role !== "ADMIN" && user.role !== "PROJECT_MANAGER") {
      throw new ForbiddenError("You are not allowed to update this project");
    }

    if (payload.status !== undefined && payload.status !== project.status) {
      const allowed = PROJECT_STATUS_TRANSITIONS[project.status] ?? [];
      if (!allowed.includes(payload.status)) {
        throw new ConflictError(`Cannot transition project from ${project.status} to ${payload.status}`);
      }
    }

    if (payload.managerId !== undefined && payload.managerId !== null) {
      const manager = await prisma.user.findFirst({
        where: { id: payload.managerId, companyId: user.companyId, role: "PROJECT_MANAGER" },
        select: { id: true },
      });
      if (!manager) {
        throw new NotFoundError("Project manager not found");
      }
    }

    const data: UpdateProjectData = {};
    if (payload.name !== undefined) data.name = payload.name;
    if (payload.description !== undefined) data.description = payload.description;
    if (payload.location !== undefined) data.location = payload.location;
    if (payload.clientInfo !== undefined) data.clientInfo = payload.clientInfo;
    if (payload.startDate !== undefined) data.startDate = parseDate(payload.startDate);
    if (payload.expectedEndDate !== undefined) data.expectedEndDate = parseDate(payload.expectedEndDate);
    if (payload.actualEndDate !== undefined) data.actualEndDate = parseDate(payload.actualEndDate);
    if (payload.budget !== undefined) data.budget = payload.budget;
    if (payload.status !== undefined) data.status = payload.status;
    if (payload.progressPercentage !== undefined) data.progressPercentage = payload.progressPercentage;
    if (payload.managerId !== undefined) data.managerId = payload.managerId;

    const updated = await this.projectRepository.update(id, data);
    if (payload.managerId !== undefined && payload.managerId !== null) {
      await prisma.projectMember.upsert({
        where: { projectId_userId: { projectId: id, userId: payload.managerId } },
        create: { projectId: id, userId: payload.managerId },
        update: {},
      });
    }
    return toResponse(updated);
  }

  async delete(user: JWTPayload, id: string): Promise<void> {
    const project = await this.projectRepository.findOwnedById(id, user.companyId);

    if (!project) {
      throw new NotFoundError("Project not found");
    }

    if (user.role !== "ADMIN") {
      throw new ForbiddenError("Only administrators can delete projects");
    }

    await this.projectRepository.delete(id);
  }

  private async assertAccess(user: JWTPayload, project: ProjectRow): Promise<void> {
    if (user.role === "ADMIN") return;
    if (project.managerId === user.sub) return;

    const membership = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: project.id, userId: user.sub } },
      select: { id: true },
    });

    if (!membership) {
      throw new NotFoundError("Project not found");
    }
  }
}
