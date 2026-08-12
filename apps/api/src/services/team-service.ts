import type { CompanyRole, ListProjectMembersQuery } from "@construction-ops/validation";

import {
  ProjectRepository,
  type ProjectMemberRecord,
  type ProjectRecord,
} from "../repositories/project-repository.js";
import { UserRepository } from "../repositories/user-repository.js";
import { ConflictError, ForbiddenError, NotFoundError } from "../utils/errors.js";

export class TeamService {
  private readonly projectRepository: ProjectRepository;
  private readonly userRepository: UserRepository;

  constructor(projectRepository = new ProjectRepository(), userRepository = new UserRepository()) {
    this.projectRepository = projectRepository;
    this.userRepository = userRepository;
  }

  async listMembers(
    userId: string,
    companyId: string,
    role: CompanyRole,
    projectId: string,
    query: ListProjectMembersQuery,
  ): Promise<{ members: ProjectMemberRecord[]; total: number }> {
    const project = await this.requireProject(companyId, projectId);

    if (!(await this.canViewProject(project, userId, role))) {
      throw new ForbiddenError("You do not have access to this project");
    }

    const result = await this.projectRepository.listMembers(projectId, companyId, query);

    if (!result) {
      throw new NotFoundError("Project not found");
    }

    return result;
  }

  async addMember(
    userId: string,
    companyId: string,
    role: CompanyRole,
    projectId: string,
    targetUserId: string,
  ): Promise<ProjectMemberRecord> {
    const project = await this.requireProject(companyId, projectId);

    this.assertCanManageMembers(project, userId, role);

    await this.assertActiveUserInCompany(targetUserId, companyId);

    const result = await this.projectRepository.addMember(projectId, companyId, targetUserId);

    if (result.status === "duplicate") {
      throw new ConflictError("User is already a member of this project");
    }

    if (result.status === "project_not_found") {
      throw new NotFoundError("Project not found");
    }

    if (result.status === "user_not_found") {
      throw new NotFoundError("User not found");
    }

    return result.member;
  }

  async removeMember(
    userId: string,
    companyId: string,
    role: CompanyRole,
    projectId: string,
    targetUserId: string,
  ): Promise<void> {
    const project = await this.requireProject(companyId, projectId);

    this.assertCanManageMembers(project, userId, role);

    if (project.managerId === targetUserId) {
      throw new ForbiddenError("The project manager cannot be removed from the project");
    }

    const result = await this.projectRepository.removeMember(projectId, companyId, targetUserId);

    if (result.status === "project_not_found") {
      throw new NotFoundError("Project not found");
    }

    if (result.status === "member_not_found") {
      throw new NotFoundError("Member not found");
    }
  }

  private async requireProject(companyId: string, projectId: string): Promise<ProjectRecord> {
    const project = await this.projectRepository.findById(projectId, companyId);

    if (!project) {
      throw new NotFoundError("Project not found");
    }

    return project;
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

  private assertCanManageMembers(project: ProjectRecord, userId: string, role: CompanyRole): void {
    if (role === "ADMIN") {
      return;
    }

    if (role === "PROJECT_MANAGER" && project.managerId === userId) {
      return;
    }

    throw new ForbiddenError("You do not have permission to manage this project");
  }

  private async assertActiveUserInCompany(targetUserId: string, companyId: string): Promise<void> {
    const user = await this.userRepository.findByIdInCompany(targetUserId, companyId);

    if (!user) {
      throw new NotFoundError("User not found");
    }

    if (user.status !== "ACTIVE") {
      throw new ConflictError("Only active users can be added to a project");
    }
  }
}
