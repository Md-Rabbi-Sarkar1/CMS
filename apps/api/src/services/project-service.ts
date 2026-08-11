import type {
  CompanyRole,
  CreateProjectInput,
  ListProjectsQuery,
  UpdateProjectInput,
  UpdateProjectProgressInput,
  UpdateProjectStatusInput,
} from "@construction-ops/validation";

import { canTransitionProjectStatus } from "@construction-ops/validation";

import {
  ProjectRepository,
  type ProjectAccessFilter,
  type ProjectRecord,
} from "../repositories/project-repository.js";
import { UserRepository } from "../repositories/user-repository.js";
import { ConflictError, ForbiddenError, NotFoundError } from "../utils/errors.js";

export class ProjectService {
  private readonly projectRepository: ProjectRepository;
  private readonly userRepository: UserRepository;

  constructor(projectRepository = new ProjectRepository(), userRepository = new UserRepository()) {
    this.projectRepository = projectRepository;
    this.userRepository = userRepository;
  }

  async listProjects(
    userId: string,
    companyId: string,
    role: CompanyRole,
    query: ListProjectsQuery,
  ): Promise<{ projects: ProjectRecord[]; total: number }> {
    const access = this.buildAccessFilter(userId, role);

    const [projects, total] = await Promise.all([
      this.projectRepository.findMany(companyId, query, access),
      this.projectRepository.count(companyId, query, access),
    ]);

    return { projects, total };
  }

  async getProject(
    userId: string,
    companyId: string,
    role: CompanyRole,
    projectId: string,
  ): Promise<ProjectRecord> {
    const project = await this.projectRepository.findById(projectId, companyId);

    if (!project) {
      throw new NotFoundError("Project not found");
    }

    if (!(await this.canViewProject(project, userId, role))) {
      throw new ForbiddenError("You do not have access to this project");
    }

    return project;
  }

  async createProject(
    userId: string,
    companyId: string,
    role: CompanyRole,
    input: CreateProjectInput,
  ): Promise<ProjectRecord> {
    if (role !== "ADMIN" && role !== "PROJECT_MANAGER") {
      throw new ForbiddenError("Only ADMIN or PROJECT_MANAGER can create projects");
    }

    const managerId = await this.resolveManagerId(userId, companyId, input.managerId);

    return this.projectRepository.create({
      companyId,
      name: input.name,
      managerId,
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.location !== undefined ? { location: input.location } : {}),
      ...(input.clientInfo !== undefined ? { clientInfo: input.clientInfo } : {}),
      ...(input.startDate !== undefined ? { startDate: input.startDate } : {}),
      ...(input.expectedEndDate !== undefined ? { expectedEndDate: input.expectedEndDate } : {}),
      ...(input.budget !== undefined ? { budget: input.budget } : {}),
    });
  }

  async updateProject(
    userId: string,
    companyId: string,
    role: CompanyRole,
    projectId: string,
    input: UpdateProjectInput,
  ): Promise<ProjectRecord> {
    const project = await this.projectRepository.findById(projectId, companyId);

    if (!project) {
      throw new NotFoundError("Project not found");
    }

    this.assertCanManageProject(project, userId, role);

    if (input.managerId !== undefined && input.managerId !== null) {
      await this.assertManagerInCompany(input.managerId, companyId);
    }

    const updated = await this.projectRepository.update(projectId, companyId, input);

    if (!updated) {
      throw new NotFoundError("Project not found");
    }

    return updated;
  }

  async changeProjectStatus(
    userId: string,
    companyId: string,
    role: CompanyRole,
    projectId: string,
    input: UpdateProjectStatusInput,
  ): Promise<ProjectRecord> {
    const project = await this.projectRepository.findById(projectId, companyId);

    if (!project) {
      throw new NotFoundError("Project not found");
    }

    this.assertCanManageProject(project, userId, role);

    if (!canTransitionProjectStatus(project.status, input.status)) {
      throw new ConflictError(`Cannot transition project from ${project.status} to ${input.status}`);
    }

    const updated = await this.projectRepository.updateStatus(projectId, companyId, input.status);

    if (!updated) {
      throw new NotFoundError("Project not found");
    }

    return updated;
  }

  async updateProjectProgress(
    userId: string,
    companyId: string,
    role: CompanyRole,
    projectId: string,
    input: UpdateProjectProgressInput,
  ): Promise<ProjectRecord> {
    const project = await this.projectRepository.findById(projectId, companyId);

    if (!project) {
      throw new NotFoundError("Project not found");
    }

    this.assertCanManageProject(project, userId, role);

    const updated = await this.projectRepository.updateProgress(projectId, companyId, input.progressPercentage);

    if (!updated) {
      throw new NotFoundError("Project not found");
    }

    return updated;
  }

  private buildAccessFilter(userId: string, role: CompanyRole): ProjectAccessFilter | undefined {
    if (role === "ADMIN") {
      return undefined;
    }

    if (role === "PROJECT_MANAGER") {
      return { managerId: userId, memberId: userId };
    }

    return { memberId: userId };
  }

  private async canViewProject(project: ProjectRecord, userId: string, role: CompanyRole): Promise<boolean> {
    if (role === "ADMIN") {
      return true;
    }

    if (role === "PROJECT_MANAGER" && project.managerId === userId) {
      return true;
    }

    return this.projectRepository.isMember(project.id, userId);
  }

  private assertCanManageProject(project: ProjectRecord, userId: string, role: CompanyRole): void {
    if (role === "ADMIN") {
      return;
    }

    if (role === "PROJECT_MANAGER" && project.managerId === userId) {
      return;
    }

    throw new ForbiddenError("You do not have permission to manage this project");
  }

  private async resolveManagerId(
    userId: string,
    companyId: string,
    managerId: string | undefined,
  ): Promise<string> {
    if (managerId === undefined) {
      return userId;
    }

    await this.assertManagerInCompany(managerId, companyId);
    return managerId;
  }

  private async assertManagerInCompany(managerId: string, companyId: string): Promise<void> {
    const manager = await this.userRepository.findByIdInCompany(managerId, companyId);

    if (!manager) {
      throw new NotFoundError("Manager not found");
    }
  }
}
