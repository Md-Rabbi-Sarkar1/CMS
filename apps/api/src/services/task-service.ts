import type { CreateTaskInput, UpdateTaskInput } from "@construction-ops/validation";
import { TASK_STATUS_TRANSITIONS } from "@construction-ops/validation";
import type { TaskPriority, TaskStatus } from "@construction-ops/database";

import { prisma } from "../providers/database.js";
import {
  TaskRepository,
  type TaskListFilters,
  type TaskRow,
  type CreateTaskData,
  type UpdateTaskData,
} from "../repositories/task-repository.js";
import { NotificationEventService } from "./notification-event-service.js";
import { ConflictError, ForbiddenError, NotFoundError } from "../utils/errors.js";
import type { CompanyRole, JWTPayload } from "../types/auth.js";

export interface TaskResponse {
  id: string;
  projectId: string;
  assigneeId: string | null;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  startDate: string | null;
  dueDate: string | null;
  completionDate: string | null;
  assignee: { id: string; name: string; email: string } | null;
  project: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
}

export interface TaskListResponse {
  items: TaskResponse[];
  total: number;
  page: number;
  pageSize: number;
}

const TASK_CREATORS: ReadonlySet<CompanyRole> = new Set([
  "ADMIN",
  "PROJECT_MANAGER",
  "ENGINEER",
]);

function parseDate(value: string): Date {
  return new Date(value);
}

function toResponse(task: TaskRow): TaskResponse {
  return {
    id: task.id,
    projectId: task.projectId,
    assigneeId: task.assigneeId,
    title: task.title,
    description: task.description,
    priority: task.priority,
    status: task.status,
    startDate: task.startDate ? task.startDate.toISOString().slice(0, 10) : null,
    dueDate: task.dueDate ? task.dueDate.toISOString().slice(0, 10) : null,
    completionDate: task.completionDate ? task.completionDate.toISOString().slice(0, 10) : null,
    assignee: task.assignee
      ? { id: task.assignee.id, name: task.assignee.name, email: task.assignee.email }
      : null,
    project: { id: task.project.id, name: task.project.name },
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
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

export class TaskService {
  private readonly taskRepository: TaskRepository;
  private readonly notificationEvents: NotificationEventService;

  constructor(
    taskRepository: TaskRepository = new TaskRepository(),
    notificationEvents: NotificationEventService = new NotificationEventService(),
  ) {
    this.taskRepository = taskRepository;
    this.notificationEvents = notificationEvents;
  }

  async create(
    user: JWTPayload,
    projectId: string,
    payload: CreateTaskInput,
  ): Promise<TaskResponse> {
    if (!TASK_CREATORS.has(user.role)) {
      throw new ForbiddenError("You are not allowed to create tasks");
    }

    await assertProjectAccess(user, projectId);

    if (payload.assigneeId !== undefined) {
      const assignee = await prisma.user.findFirst({
        where: {
          id: payload.assigneeId,
          companyId: user.companyId,
          OR: [{ projectMembers: { some: { projectId } } }, { managedProjects: { some: { id: projectId } } }],
        },
        select: { id: true },
      });
      if (!assignee) {
        throw new NotFoundError("Assignee not found");
      }
    }

    const data: CreateTaskData = {
      projectId,
      title: payload.title,
    };
    if (payload.description !== undefined) data.description = payload.description;
    if (payload.priority !== undefined) data.priority = payload.priority;
    if (payload.startDate !== undefined) data.startDate = parseDate(payload.startDate);
    if (payload.dueDate !== undefined) data.dueDate = parseDate(payload.dueDate);
    if (payload.assigneeId !== undefined) data.assigneeId = payload.assigneeId;

    const task = await this.taskRepository.create(data);

    if (task.assigneeId !== null) {
      await this.notificationEvents.taskAssigned({
        assigneeId: task.assigneeId,
        taskTitle: task.title,
        projectName: task.project.name,
        dueDate: task.dueDate,
      });
    }

    return toResponse(task);
  }

  async list(
    user: JWTPayload,
    projectId: string | undefined,
    query: {
      page: number;
      pageSize: number;
      status?: TaskStatus | undefined;
      priority?: TaskPriority | undefined;
      assigneeId?: string | undefined;
    },
  ): Promise<TaskListResponse> {
    const filters: TaskListFilters = {
      companyId: user.companyId,
      page: query.page,
      pageSize: query.pageSize,
    };
    if (projectId !== undefined) filters.projectId = projectId;
    if (query.status !== undefined) filters.status = query.status;
    if (query.priority !== undefined) filters.priority = query.priority;

    // Workers only see tasks assigned to them; engineers see assigned tasks;
    // admins/PMs see all company tasks (optionally filtered by assignee).
    if (user.role === "WORKER" || user.role === "ENGINEER") {
      filters.assigneeId = user.sub;
    } else if (query.assigneeId !== undefined) {
      filters.assigneeId = query.assigneeId;
    }

    const result = await this.taskRepository.list(filters);
    return {
      items: result.items.map(toResponse),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    };
  }

  async getById(user: JWTPayload, id: string): Promise<TaskResponse> {
    const task = await this.taskRepository.findOwnedById(id, user.companyId);

    if (!task) {
      throw new NotFoundError("Task not found");
    }

    await assertProjectAccess(user, task.projectId);

    if ((user.role === "WORKER" || user.role === "ENGINEER") && task.assigneeId !== user.sub) {
      throw new NotFoundError("Task not found");
    }

    return toResponse(task);
  }

  async update(user: JWTPayload, id: string, payload: UpdateTaskInput): Promise<TaskResponse> {
    const task = await this.taskRepository.findOwnedById(id, user.companyId);

    if (!task) {
      throw new NotFoundError("Task not found");
    }

    await assertProjectAccess(user, task.projectId);

    const isAssignee = task.assigneeId === user.sub;
    const isManager = user.role === "ADMIN" || user.role === "PROJECT_MANAGER";

    if (!isManager && !isAssignee) {
      throw new ForbiddenError("You are not allowed to update this task");
    }

    // Assignees (workers/engineers) may only update their own task's editable
    // fields, not reassign. Status changes go through the dedicated transition
    // endpoint, so they are intentionally not part of UpdateTaskInput.
    if (!isManager) {
      const restrictedKeys = ["title", "description", "assigneeId", "priority", "startDate", "dueDate"];
      for (const key of restrictedKeys) {
        if ((payload as Record<string, unknown>)[key] !== undefined) {
          throw new ForbiddenError("You can only update the task status");
        }
      }
    }

    if (payload.assigneeId !== undefined && payload.assigneeId !== null) {
      const assignee = await prisma.user.findFirst({
        where: {
          id: payload.assigneeId,
          companyId: user.companyId,
          OR: [
            { projectMembers: { some: { projectId: task.projectId } } },
            { managedProjects: { some: { id: task.projectId } } },
          ],
        },
        select: { id: true },
      });
      if (!assignee) {
        throw new NotFoundError("Assignee not found");
      }
    }

    const data: UpdateTaskData = {};
    if (payload.title !== undefined) data.title = payload.title;
    if (payload.description !== undefined) data.description = payload.description;
    if (payload.priority !== undefined) data.priority = payload.priority;
    if (payload.startDate !== undefined) data.startDate = parseDate(payload.startDate);
    if (payload.dueDate !== undefined) data.dueDate = parseDate(payload.dueDate);
    if (payload.completionDate !== undefined) data.completionDate = parseDate(payload.completionDate);
    if (payload.assigneeId !== undefined) data.assigneeId = payload.assigneeId;

    const updated = await this.taskRepository.update(id, data);

    if (payload.assigneeId !== undefined && updated.assigneeId !== null) {
      await this.notificationEvents.taskAssigned({
        assigneeId: updated.assigneeId,
        taskTitle: updated.title,
        projectName: updated.project.name,
        dueDate: updated.dueDate,
      });
    }

    return toResponse(updated);
  }

  async transitionStatus(user: JWTPayload, id: string, status: TaskStatus): Promise<TaskResponse> {
    const task = await this.taskRepository.findOwnedById(id, user.companyId);

    if (!task) {
      throw new NotFoundError("Task not found");
    }

    await assertProjectAccess(user, task.projectId);

    const isAssignee = task.assigneeId === user.sub;
    const isManager = user.role === "ADMIN" || user.role === "PROJECT_MANAGER";

    if (!isManager && !isAssignee) {
      throw new ForbiddenError("You are not allowed to update this task");
    }

    if (status !== task.status) {
      const allowed = TASK_STATUS_TRANSITIONS[task.status] ?? [];
      if (!allowed.includes(status)) {
        throw new ConflictError(`Cannot transition task from ${task.status} to ${status}`);
      }
    }

    const data: UpdateTaskData = { status };
    if (status === "COMPLETED") {
      data.completionDate = new Date();
    }

    const updated = await this.taskRepository.update(id, data);
    return toResponse(updated);
  }

  async delete(user: JWTPayload, id: string): Promise<void> {
    const task = await this.taskRepository.findOwnedById(id, user.companyId);

    if (!task) {
      throw new NotFoundError("Task not found");
    }

    await assertProjectAccess(user, task.projectId);

    if (user.role !== "ADMIN" && user.role !== "PROJECT_MANAGER") {
      throw new ForbiddenError("You are not allowed to delete this task");
    }

    await this.taskRepository.delete(id);
  }
}
