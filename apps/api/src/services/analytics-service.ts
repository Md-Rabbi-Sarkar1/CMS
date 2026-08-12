import type { CompanyRole } from "@construction-ops/validation";

import {
  ProjectRepository,
  type ProjectRecord,
} from "../repositories/project-repository.js";
import { TaskRepository } from "../repositories/task-repository.js";
import { UserRepository } from "../repositories/user-repository.js";
import { ForbiddenError, NotFoundError } from "../utils/errors.js";

export interface CompanyDashboard {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  totalTeamMembers: number;
  totalTasks: number;
  completedTasks: number;
  openTasks: number;
}

export interface ProjectDashboard {
  progressPercentage: number;
  budget: string | null;
  totalTasks: number;
  completedTasks: number;
  openTasks: number;
  openIssues: number;
  recentActivity: string[];
}

export class AnalyticsService {
  private readonly projectRepository: ProjectRepository;
  private readonly taskRepository: TaskRepository;
  private readonly userRepository: UserRepository;

  constructor(
    projectRepository = new ProjectRepository(),
    taskRepository = new TaskRepository(),
    userRepository = new UserRepository(),
  ) {
    this.projectRepository = projectRepository;
    this.taskRepository = taskRepository;
    this.userRepository = userRepository;
  }

  async getCompanyDashboard(
    userId: string,
    companyId: string,
    role: CompanyRole,
  ): Promise<CompanyDashboard> {
    if (role !== "ADMIN") {
      throw new ForbiddenError("Only ADMIN can view company dashboard");
    }

    const [totalProjects, activeProjects, completedProjects, totalTeamMembers, totalTasks, completedTasks] =
      await Promise.all([
        this.projectRepository.countByCompany(companyId),
        this.projectRepository.countByStatus(companyId, "ACTIVE"),
        this.projectRepository.countByStatus(companyId, "COMPLETED"),
        this.userRepository.countByCompany(companyId),
        this.taskRepository.countByCompany(companyId),
        this.taskRepository.countByStatus(companyId, "COMPLETED"),
      ]);

    const openTasks = totalTasks - completedTasks;

    return {
      totalProjects,
      activeProjects,
      completedProjects,
      totalTeamMembers,
      totalTasks,
      completedTasks,
      openTasks,
    };
  }

  async getProjectDashboard(
    userId: string,
    companyId: string,
    role: CompanyRole,
    projectId: string,
  ): Promise<ProjectDashboard> {
    const project = await this.projectRepository.findById(projectId, companyId);

    if (!project) {
      throw new NotFoundError("Project not found");
    }

    if (!(await this.canViewProject(project, userId, role))) {
      throw new ForbiddenError("You do not have access to this project");
    }

    const [totalTasks, completedTasks] = await Promise.all([
      this.taskRepository.countByProject(projectId),
      this.taskRepository.countByProjectStatus(projectId, "COMPLETED"),
    ]);

    const openTasks = totalTasks - completedTasks;

    return {
      progressPercentage: project.progressPercentage,
      budget: project.budget,
      totalTasks,
      completedTasks,
      openTasks,
      openIssues: 0,
      recentActivity: [],
    };
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
}
