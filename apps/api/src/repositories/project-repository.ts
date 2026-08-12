import type {
  CompanyRole,
  ListProjectMembersQuery,
  ListProjectsQuery,
  ProjectSort,
  ProjectStatus,
  UpdateProjectInput,
  UserStatus,
} from "@construction-ops/validation";

import { prisma } from "../providers/database.js";

export interface ProjectRecord {
  id: string;
  companyId: string;
  managerId: string | null;
  name: string;
  description: string | null;
  location: string | null;
  clientInfo: string | null;
  startDate: Date | null;
  expectedEndDate: Date | null;
  actualEndDate: Date | null;
  budget: string | null;
  status: ProjectStatus;
  progressPercentage: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProjectData {
  companyId: string;
  managerId?: string;
  name: string;
  description?: string;
  location?: string;
  clientInfo?: string;
  startDate?: string;
  expectedEndDate?: string;
  budget?: number;
}

export interface ProjectAccessFilter {
  managerId?: string;
  memberId?: string;
}

export interface ProjectMemberRecord {
  userId: string;
  name: string;
  email: string;
  role: CompanyRole;
  status: UserStatus;
  assignedAt: Date;
}

export interface ProjectMemberListResult {
  members: ProjectMemberRecord[];
  total: number;
}

export type AddProjectMemberResult =
  | { status: "added"; member: ProjectMemberRecord }
  | { status: "duplicate" }
  | { status: "project_not_found" }
  | { status: "user_not_found" };

export type RemoveProjectMemberResult =
  | { status: "removed" }
  | { status: "project_not_found" }
  | { status: "member_not_found" };

type ProjectOrderBy =
  | { createdAt: "asc" | "desc" }
  | { name: "asc" | "desc" }
  | { startDate: "asc" | "desc" };

interface ProjectRow {
  id: string;
  companyId: string;
  managerId: string | null;
  name: string;
  description: string | null;
  location: string | null;
  clientInfo: string | null;
  startDate: Date | null;
  expectedEndDate: Date | null;
  actualEndDate: Date | null;
  budget: { toString(): string } | null;
  status: ProjectStatus;
  progressPercentage: number;
  createdAt: Date;
  updatedAt: Date;
}

interface ProjectMemberRow {
  assignedAt: Date;
  user: {
    id: string;
    name: string;
    email: string;
    role: CompanyRole;
    status: UserStatus;
  };
}

const PROJECT_MEMBER_SELECT = {
  assignedAt: true,
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
    },
  },
} as const;

const PROJECT_ORDER_BY: Record<ProjectSort, ProjectOrderBy> = {
  "createdAt:asc": { createdAt: "asc" },
  "createdAt:desc": { createdAt: "desc" },
  "name:asc": { name: "asc" },
  "name:desc": { name: "desc" },
  "startDate:asc": { startDate: "asc" },
  "startDate:desc": { startDate: "desc" },
};

function toProjectRecord(project: ProjectRow): ProjectRecord {
  return {
    ...project,
    budget: project.budget === null ? null : project.budget.toString(),
  };
}

function toProjectMemberRecord(member: ProjectMemberRow): ProjectMemberRecord {
  return {
    userId: member.user.id,
    name: member.user.name,
    email: member.user.email,
    role: member.user.role,
    status: member.user.status,
    assignedAt: member.assignedAt,
  };
}

function buildAccessCondition(access: ProjectAccessFilter) {
  if (access.managerId !== undefined && access.memberId !== undefined) {
    return {
      OR: [
        { managerId: access.managerId },
        { members: { some: { userId: access.memberId } } },
      ],
    };
  }

  if (access.managerId !== undefined) {
    return { managerId: access.managerId };
  }

  if (access.memberId !== undefined) {
    return { members: { some: { userId: access.memberId } } };
  }

  return {};
}

export class ProjectRepository {
  async findMany(
    companyId: string,
    query: ListProjectsQuery,
    access?: ProjectAccessFilter,
  ): Promise<ProjectRecord[]> {
    const projects = await prisma.project.findMany({
      where: this.buildWhere(companyId, query, access),
      orderBy: query.sort !== undefined ? PROJECT_ORDER_BY[query.sort] : { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    });

    return projects.map(toProjectRecord);
  }

  count(companyId: string, query: ListProjectsQuery, access?: ProjectAccessFilter): Promise<number> {
    return prisma.project.count({
      where: this.buildWhere(companyId, query, access),
    });
  }

  async findById(id: string, companyId: string): Promise<ProjectRecord | null> {
    const project = await prisma.project.findFirst({
      where: { id, companyId },
    });

    return project === null ? null : toProjectRecord(project);
  }

  async create(data: CreateProjectData): Promise<ProjectRecord> {
    const project = await prisma.project.create({
      data: {
        companyId: data.companyId,
        name: data.name,
        ...(data.managerId !== undefined ? { managerId: data.managerId } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.location !== undefined ? { location: data.location } : {}),
        ...(data.clientInfo !== undefined ? { clientInfo: data.clientInfo } : {}),
        ...(data.startDate !== undefined ? { startDate: data.startDate } : {}),
        ...(data.expectedEndDate !== undefined ? { expectedEndDate: data.expectedEndDate } : {}),
        ...(data.budget !== undefined ? { budget: data.budget } : {}),
      },
    });

    return toProjectRecord(project);
  }

  async update(id: string, companyId: string, input: UpdateProjectInput): Promise<ProjectRecord | null> {
    const updates = {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.location !== undefined ? { location: input.location } : {}),
      ...(input.clientInfo !== undefined ? { clientInfo: input.clientInfo } : {}),
      ...(input.startDate !== undefined ? { startDate: input.startDate } : {}),
      ...(input.expectedEndDate !== undefined ? { expectedEndDate: input.expectedEndDate } : {}),
      ...(input.budget !== undefined ? { budget: input.budget } : {}),
      ...(input.managerId !== undefined ? { managerId: input.managerId } : {}),
    };

    const result = await prisma.project.updateMany({
      where: { id, companyId },
      data: updates,
    });

    if (result.count === 0) {
      return null;
    }

    return this.findById(id, companyId);
  }

  async updateStatus(id: string, companyId: string, status: ProjectStatus): Promise<ProjectRecord | null> {
    const result = await prisma.project.updateMany({
      where: { id, companyId },
      data: { status },
    });

    if (result.count === 0) {
      return null;
    }

    return this.findById(id, companyId);
  }

  async updateProgress(id: string, companyId: string, progressPercentage: number): Promise<ProjectRecord | null> {
    const result = await prisma.project.updateMany({
      where: { id, companyId },
      data: { progressPercentage },
    });

    if (result.count === 0) {
      return null;
    }

    return this.findById(id, companyId);
  }

  async isMember(projectId: string, userId: string): Promise<boolean> {
    const membership = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
      select: { id: true },
    });

    return membership !== null;
  }

  async listMembers(
    projectId: string,
    companyId: string,
    query: ListProjectMembersQuery,
  ): Promise<ProjectMemberListResult | null> {
    const project = await prisma.project.findFirst({
      where: { id: projectId, companyId },
      select: { id: true },
    });

    if (project === null) {
      return null;
    }

    const where = { projectId };
    const [members, total] = await Promise.all([
      prisma.projectMember.findMany({
        where,
        select: PROJECT_MEMBER_SELECT,
        orderBy: { assignedAt: "asc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.projectMember.count({ where }),
    ]);

    return {
      members: members.map(toProjectMemberRecord),
      total,
    };
  }

  async addMember(projectId: string, companyId: string, userId: string): Promise<AddProjectMemberResult> {
    const project = await prisma.project.findFirst({
      where: { id: projectId, companyId },
      select: { id: true },
    });

    if (project === null) {
      return { status: "project_not_found" };
    }

    const user = await prisma.user.findFirst({
      where: { id: userId, companyId },
      select: { id: true },
    });

    if (user === null) {
      return { status: "user_not_found" };
    }

    const existing = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
      select: { id: true },
    });

    if (existing !== null) {
      return { status: "duplicate" };
    }

    const member = await prisma.projectMember.create({
      data: { projectId, userId },
      select: PROJECT_MEMBER_SELECT,
    });

    return { status: "added", member: toProjectMemberRecord(member) };
  }

  async removeMember(projectId: string, companyId: string, userId: string): Promise<RemoveProjectMemberResult> {
    const project = await prisma.project.findFirst({
      where: { id: projectId, companyId },
      select: { id: true },
    });

    if (project === null) {
      return { status: "project_not_found" };
    }

    const result = await prisma.projectMember.deleteMany({
      where: { projectId, userId },
    });

    if (result.count === 0) {
      return { status: "member_not_found" };
    }

    return { status: "removed" };
  }

  private buildWhere(companyId: string, query: ListProjectsQuery, access?: ProjectAccessFilter) {
    const andConditions = [
      query.search !== undefined
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" as const } },
              { location: { contains: query.search, mode: "insensitive" as const } },
            ],
          }
        : {},
      access !== undefined ? buildAccessCondition(access) : {},
    ].filter((condition) => Object.keys(condition).length > 0);

    return {
      companyId,
      ...(andConditions.length > 0 ? { AND: andConditions } : {}),
      ...(query.status !== undefined ? { status: query.status } : {}),
    };
  }
}
