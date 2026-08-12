import type {
  ListTasksQuery,
  TaskPriority,
  TaskSort,
  TaskStatus,
  UpdateTaskInput,
} from "@construction-ops/validation";

import { prisma } from "../providers/database.js";

export interface TaskRecord {
  id: string;
  projectId: string;
  assigneeId: string | null;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  startDate: Date | null;
  dueDate: Date | null;
  completionDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTaskData {
  projectId: string;
  title: string;
  description?: string;
  priority?: TaskPriority;
  assigneeId?: string;
  startDate?: string;
  dueDate?: string;
}

export type CreateTaskResult =
  | { status: "created"; task: TaskRecord }
  | { status: "project_not_found" };

export interface TaskAccessFilter {
  managerId?: string;
  memberId?: string;
}

type TaskOrderBy =
  | { createdAt: "asc" | "desc" }
  | { dueDate: "asc" | "desc" }
  | { title: "asc" | "desc" };

interface TaskRow {
  id: string;
  projectId: string;
  assigneeId: string | null;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  startDate: Date | null;
  dueDate: Date | null;
  completionDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const TASK_ORDER_BY: Record<TaskSort, TaskOrderBy> = {
  "createdAt:asc": { createdAt: "asc" },
  "createdAt:desc": { createdAt: "desc" },
  "dueDate:asc": { dueDate: "asc" },
  "dueDate:desc": { dueDate: "desc" },
  "title:asc": { title: "asc" },
  "title:desc": { title: "desc" },
};

function toTaskRecord(task: TaskRow): TaskRecord {
  return {
    id: task.id,
    projectId: task.projectId,
    assigneeId: task.assigneeId,
    title: task.title,
    description: task.description,
    priority: task.priority,
    status: task.status,
    startDate: task.startDate,
    dueDate: task.dueDate,
    completionDate: task.completionDate,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

function buildAccessCondition(access: TaskAccessFilter) {
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

export class TaskRepository {
  async listTasks(
    companyId: string,
    query: ListTasksQuery,
    projectId?: string,
    access?: TaskAccessFilter,
  ): Promise<{ tasks: TaskRecord[]; total: number }> {
    const where = {
      project: {
        companyId,
        ...(access !== undefined ? buildAccessCondition(access) : {}),
      },
      ...(projectId !== undefined ? { projectId } : {}),
      ...(query.status !== undefined ? { status: query.status } : {}),
      ...(query.assigneeId !== undefined ? { assigneeId: query.assigneeId } : {}),
    };

    const orderBy: TaskOrderBy = query.sort !== undefined ? TASK_ORDER_BY[query.sort] : { createdAt: "desc" };

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.task.count({ where }),
    ]);

    return {
      tasks: tasks.map(toTaskRecord),
      total,
    };
  }

  async findById(taskId: string, companyId: string): Promise<TaskRecord | null> {
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        project: { companyId },
      },
    });

    return task === null ? null : toTaskRecord(task);
  }

  async create(data: CreateTaskData, companyId: string): Promise<CreateTaskResult> {
    const project = await prisma.project.findFirst({
      where: { id: data.projectId, companyId },
      select: { id: true },
    });

    if (project === null) {
      return { status: "project_not_found" };
    }

    const task = await prisma.task.create({
      data: {
        projectId: data.projectId,
        title: data.title,
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.priority !== undefined ? { priority: data.priority } : {}),
        ...(data.assigneeId !== undefined ? { assigneeId: data.assigneeId } : {}),
        ...(data.startDate !== undefined ? { startDate: new Date(data.startDate) } : {}),
        ...(data.dueDate !== undefined ? { dueDate: new Date(data.dueDate) } : {}),
      },
    });

    return { status: "created", task: toTaskRecord(task) };
  }

  async update(id: string, companyId: string, input: UpdateTaskInput): Promise<TaskRecord | null> {
    const updates = {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.assigneeId !== undefined ? { assigneeId: input.assigneeId } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.startDate !== undefined ? { startDate: input.startDate === null ? null : new Date(input.startDate) } : {}),
      ...(input.dueDate !== undefined ? { dueDate: input.dueDate === null ? null : new Date(input.dueDate) } : {}),
    };

    const result = await prisma.task.updateMany({
      where: { id, project: { companyId } },
      data: updates,
    });

    if (result.count === 0) {
      return null;
    }

    return this.findById(id, companyId);
  }

  async updateStatus(
    id: string,
    companyId: string,
    status: TaskStatus,
    completionDate?: Date | null,
  ): Promise<TaskRecord | null> {
    const result = await prisma.task.updateMany({
      where: { id, project: { companyId } },
      data: {
        status,
        ...(completionDate !== undefined ? { completionDate } : {}),
      },
    });

    if (result.count === 0) {
      return null;
    }

    return this.findById(id, companyId);
  }
}
