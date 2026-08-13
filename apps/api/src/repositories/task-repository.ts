import type { Prisma, PrismaClient, TaskPriority, TaskStatus } from "@construction-ops/database";

import { prisma } from "../providers/database.js";

export interface TaskListFilters {
  companyId: string;
  page: number;
  pageSize: number;
  projectId?: string | undefined;
  status?: TaskStatus | undefined;
  priority?: TaskPriority | undefined;
  assigneeId?: string | undefined;
}

export interface TaskListResult {
  items: TaskRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateTaskData {
  projectId: string;
  assigneeId?: string;
  title: string;
  description?: string;
  priority?: TaskPriority;
  startDate?: Date;
  dueDate?: Date;
}

export interface UpdateTaskData {
  title?: string;
  description?: string;
  assigneeId?: string | null;
  priority?: TaskPriority;
  startDate?: Date;
  dueDate?: Date;
  completionDate?: Date;
  status?: TaskStatus;
}

export type TaskRow = Prisma.TaskGetPayload<{
  include: {
    assignee: { select: { id: true; name: true; email: true } };
    project: { select: { id: true; name: true; companyId: true } };
  };
}>;

const taskInclude = {
  assignee: { select: { id: true, name: true, email: true } },
  project: { select: { id: true, name: true, companyId: true } },
} satisfies Prisma.TaskInclude;

export class TaskRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  async list(filters: TaskListFilters): Promise<TaskListResult> {
    const where: Prisma.TaskWhereInput = {
      project: { companyId: filters.companyId },
    };
    if (filters.projectId !== undefined) where.projectId = filters.projectId;
    if (filters.status !== undefined) where.status = filters.status;
    if (filters.priority !== undefined) where.priority = filters.priority;
    if (filters.assigneeId !== undefined) where.assigneeId = filters.assigneeId;

    const [items, total] = await this.client.$transaction([
      this.client.task.findMany({
        where,
        include: taskInclude,
        orderBy: { createdAt: "desc" },
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
      }),
      this.client.task.count({ where }),
    ]);

    return { items, total, page: filters.page, pageSize: filters.pageSize };
  }

  findOwnedById(id: string, companyId: string): Promise<TaskRow | null> {
    return this.client.task.findFirst({
      where: { id, project: { companyId } },
      include: taskInclude,
    });
  }

  create(data: CreateTaskData): Promise<TaskRow> {
    const createData: Prisma.TaskCreateInput = {
      project: { connect: { id: data.projectId } },
      title: data.title,
    };
    if (data.description !== undefined) createData.description = data.description;
    if (data.priority !== undefined) createData.priority = data.priority;
    if (data.startDate !== undefined) createData.startDate = data.startDate;
    if (data.dueDate !== undefined) createData.dueDate = data.dueDate;
    if (data.assigneeId !== undefined) createData.assignee = { connect: { id: data.assigneeId } };

    return this.client.task.create({ data: createData, include: taskInclude });
  }

  update(id: string, data: UpdateTaskData): Promise<TaskRow> {
    const updateData: Prisma.TaskUpdateInput = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.startDate !== undefined) updateData.startDate = data.startDate;
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate;
    if (data.completionDate !== undefined) updateData.completionDate = data.completionDate;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.assigneeId !== undefined) {
      updateData.assignee = data.assigneeId === null ? { disconnect: true } : { connect: { id: data.assigneeId } };
    }

    return this.client.task.update({ where: { id }, data: updateData, include: taskInclude });
  }

  delete(id: string): Promise<void> {
    return this.client.task.delete({ where: { id } }).then(() => undefined);
  }
}
