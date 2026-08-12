import type {
  CompanyRole,
  CreateTaskInput,
  ListTasksQuery,
  TaskStatus,
  UpdateTaskInput,
} from "@construction-ops/validation";

import { canTransitionTaskStatus } from "@construction-ops/validation";

import {
  ProjectRepository,
  type ProjectRecord,
} from "../repositories/project-repository.js";
import {
  TaskRepository,
  type TaskAccessFilter,
  type TaskRecord,
} from "../repositories/task-repository.js";
import { UserRepository } from "../repositories/user-repository.js";
import { ConflictError, ForbiddenError, NotFoundError } from "../utils/errors.js";

export class TaskService {
  private readonly taskRepository: TaskRepository;
  private readonly projectRepository: ProjectRepository;
  private readonly userRepository: UserRepository;

  constructor(
    taskRepository = new TaskRepository(),
    projectRepository = new ProjectRepository(),
    userRepository = new UserRepository(),
  ) {
    this.taskRepository = taskRepository;
    this.projectRepository = projectRepository;
    this.userRepository = userRepository;
  }

  async listTasks(
    userId: string,
    companyId: string,
    role: CompanyRole,
    query: ListTasksQuery,
  ): Promise<{ tasks: TaskRecord[]; total: number }> {
    const access = this.buildAccessFilter(userId, role);

    return this.taskRepository.listTasks(companyId, query, undefined, access);
  }

  async listProjectTasks(
    userId: string,
    companyId: string,
    role: CompanyRole,
    projectId: string,
    query: ListTasksQuery,
  ): Promise<{ tasks: TaskRecord[]; total: number }> {
    const project = await this.requireProject(companyId, projectId);

    if (!(await this.canViewProject(project, userId, role))) {
      throw new ForbiddenError("You do not have access to this project");
    }

    return this.taskRepository.listTasks(companyId, query, projectId);
  }

  async getTask(
    userId: string,
    companyId: string,
    role: CompanyRole,
    taskId: string,
  ): Promise<TaskRecord> {
    const task = await this.taskRepository.findById(taskId, companyId);

    if (!task) {
      throw new NotFoundError("Task not found");
    }

    const project = await this.requireProject(companyId, task.projectId);

    if (!(await this.canViewProject(project, userId, role))) {
      throw new ForbiddenError("You do not have access to this project");
    }

    return task;
  }

  async createTask(
    userId: string,
    companyId: string,
    role: CompanyRole,
    projectId: string,
    input: CreateTaskInput,
  ): Promise<TaskRecord> {
    const project = await this.requireProject(companyId, projectId);

    this.assertCanManageProject(project, userId, role);

    if (input.assigneeId !== undefined) {
      await this.assertValidAssignee(input.assigneeId, companyId, projectId);
    }

    const result = await this.taskRepository.create(
      {
        projectId,
        title: input.title,
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.assigneeId !== undefined ? { assigneeId: input.assigneeId } : {}),
        ...(input.startDate !== undefined ? { startDate: input.startDate } : {}),
        ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
      },
      companyId,
    );

    if (result.status === "project_not_found") {
      throw new NotFoundError("Project not found");
    }

    return result.task;
  }

  async updateTask(
    userId: string,
    companyId: string,
    role: CompanyRole,
    taskId: string,
    input: UpdateTaskInput,
  ): Promise<TaskRecord> {
    const task = await this.taskRepository.findById(taskId, companyId);

    if (!task) {
      throw new NotFoundError("Task not found");
    }

    const project = await this.requireProject(companyId, task.projectId);

    this.assertCanManageTask(project, userId, role);

    if (input.assigneeId !== undefined && input.assigneeId !== null) {
      await this.assertValidAssignee(input.assigneeId, companyId, task.projectId);
    }

    const updated = await this.taskRepository.update(taskId, companyId, input);

    if (!updated) {
      throw new NotFoundError("Task not found");
    }

    return updated;
  }

  async updateTaskStatus(
    userId: string,
    companyId: string,
    role: CompanyRole,
    taskId: string,
    newStatus: TaskStatus,
  ): Promise<TaskRecord> {
    const task = await this.taskRepository.findById(taskId, companyId);

    if (!task) {
      throw new NotFoundError("Task not found");
    }

    if (task.status === newStatus) {
      throw new ConflictError(`Task is already ${newStatus}`);
    }

    if (!canTransitionTaskStatus(task.status, newStatus)) {
      throw new ConflictError(`Cannot transition task from ${task.status} to ${newStatus}`);
    }

    const project = await this.requireProject(companyId, task.projectId);

    this.assertCanUpdateTaskStatus(task, project, userId, role);

    let completionDate: Date | null | undefined;
    if (newStatus === "COMPLETED") {
      completionDate = new Date();
    } else if (task.status === "COMPLETED") {
      completionDate = null;
    }

    const updated = await this.taskRepository.updateStatus(
      taskId,
      companyId,
      newStatus,
      completionDate,
    );

    if (!updated) {
      throw new NotFoundError("Task not found");
    }

    return updated;
  }

  private buildAccessFilter(userId: string, role: CompanyRole): TaskAccessFilter | undefined {
    if (role === "ADMIN") {
      return undefined;
    }

    if (role === "PROJECT_MANAGER") {
      return { managerId: userId, memberId: userId };
    }

    return { memberId: userId };
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

  private assertCanManageProject(project: ProjectRecord, userId: string, role: CompanyRole): void {
    if (role === "ADMIN") {
      return;
    }

    if (role === "PROJECT_MANAGER" && project.managerId === userId) {
      return;
    }

    throw new ForbiddenError("You do not have permission to manage this project");
  }

  private assertCanManageTask(project: ProjectRecord, userId: string, role: CompanyRole): void {
    if (role === "ADMIN") {
      return;
    }

    if (role === "PROJECT_MANAGER" && project.managerId === userId) {
      return;
    }

    throw new ForbiddenError("You do not have permission to edit this task");
  }

  private assertCanUpdateTaskStatus(
    task: TaskRecord,
    project: ProjectRecord,
    userId: string,
    role: CompanyRole,
  ): void {
    if (role === "ADMIN") {
      return;
    }

    if (role === "PROJECT_MANAGER" && project.managerId === userId) {
      return;
    }

    if (task.assigneeId === userId) {
      return;
    }

    throw new ForbiddenError("You do not have permission to update this task's status");
  }

  private async assertValidAssignee(assigneeId: string, companyId: string, projectId: string): Promise<void> {
    const user = await this.userRepository.findByIdInCompany(assigneeId, companyId);

    if (!user) {
      throw new NotFoundError("User not found");
    }

    if (user.status !== "ACTIVE") {
      throw new ConflictError("Only active users can be assigned to a task");
    }

    if (!(await this.projectRepository.isMember(projectId, assigneeId))) {
      throw new ConflictError("Assignee must be a member of the project");
    }
  }
}
