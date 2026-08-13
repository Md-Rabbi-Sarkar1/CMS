import { z } from "zod";

import { TASK_PRIORITIES, TASK_STATUSES } from "@construction-ops/shared";

import { uuidSchema, optionalDateSchema } from "./common.js";

const taskStatusSchema = z.enum(TASK_STATUSES);
const taskPrioritySchema = z.enum(TASK_PRIORITIES);

export const createTaskSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(255, "Title must be at most 255 characters"),
    description: z.string().max(5000, "Description must be at most 5000 characters").optional(),
    assigneeId: uuidSchema.optional(),
    priority: taskPrioritySchema.optional(),
    startDate: optionalDateSchema,
    dueDate: optionalDateSchema,
  })
  .strict();

export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(255, "Title must be at most 255 characters").optional(),
    description: z.string().max(5000, "Description must be at most 5000 characters").optional(),
    assigneeId: uuidSchema.nullable().optional(),
    priority: taskPrioritySchema.optional(),
    startDate: optionalDateSchema,
    dueDate: optionalDateSchema,
    completionDate: optionalDateSchema,
  })
  .strict();

export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export const taskStatusTransitionSchema = z
  .object({
    status: taskStatusSchema,
  })
  .strict();

export type TaskStatusTransitionInput = z.infer<typeof taskStatusTransitionSchema>;

export const taskIdParamsSchema = z.object({
  id: uuidSchema,
});

export const taskListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    status: taskStatusSchema.optional(),
    priority: taskPrioritySchema.optional(),
    assigneeId: uuidSchema.optional(),
  })
  .strict();

export type TaskListQuery = z.infer<typeof taskListQuerySchema>;

export const TASK_STATUS_TRANSITIONS: Record<string, readonly string[]> = {
  TODO: ["IN_PROGRESS", "BLOCKED", "COMPLETED"],
  IN_PROGRESS: ["REVIEW", "BLOCKED", "COMPLETED", "TODO"],
  BLOCKED: ["TODO", "IN_PROGRESS"],
  REVIEW: ["COMPLETED", "IN_PROGRESS", "TODO"],
  COMPLETED: ["TODO"],
};
