import { z } from "zod";

import { ISSUE_STATUSES, TASK_PRIORITIES } from "@construction-ops/shared";

import { uuidSchema } from "./common.js";

const issueStatusSchema = z.enum(ISSUE_STATUSES);
const issuePrioritySchema = z.enum(TASK_PRIORITIES);

export const createIssueSchema = z
  .object({
    projectId: uuidSchema,
    title: z.string().trim().min(1, "Title is required").max(255, "Title must be at most 255 characters"),
    description: z.string().trim().min(1, "Description is required").max(5000, "Description must be at most 5000 characters"),
    location: z.string().trim().max(255, "Location must be at most 255 characters").optional(),
    priority: issuePrioritySchema.optional(),
    assigneeId: uuidSchema.optional(),
  })
  .strict();

export type CreateIssueInput = z.infer<typeof createIssueSchema>;

export const updateIssueSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(255, "Title must be at most 255 characters").optional(),
    description: z.string().max(5000, "Description must be at most 5000 characters").optional(),
    location: z.string().trim().max(255, "Location must be at most 255 characters").optional(),
    priority: issuePrioritySchema.optional(),
    assigneeId: uuidSchema.nullable().optional(),
    status: issueStatusSchema.optional(),
    resolution: z.string().max(5000, "Resolution must be at most 5000 characters").optional(),
  })
  .strict();

export type UpdateIssueInput = z.infer<typeof updateIssueSchema>;

export const issueIdParamsSchema = z.object({
  id: uuidSchema,
});

export const issueListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    projectId: uuidSchema.optional(),
    status: issueStatusSchema.optional(),
    priority: issuePrioritySchema.optional(),
    assigneeId: uuidSchema.optional(),
  })
  .strict();

export type IssueListQuery = z.infer<typeof issueListQuerySchema>;

export const ISSUE_STATUS_TRANSITIONS: Record<string, readonly string[]> = {
  OPEN: ["ASSIGNED", "IN_PROGRESS", "CLOSED"],
  ASSIGNED: ["IN_PROGRESS", "OPEN", "CLOSED"],
  IN_PROGRESS: ["RESOLVED", "ASSIGNED", "CLOSED"],
  RESOLVED: ["VERIFIED", "IN_PROGRESS", "CLOSED"],
  VERIFIED: ["CLOSED", "RESOLVED"],
  CLOSED: [],
};
