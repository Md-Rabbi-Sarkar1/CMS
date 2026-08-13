import { z } from "zod";

import { PROJECT_STATUSES } from "@construction-ops/shared";

import { uuidSchema, optionalDateSchema } from "./common.js";

const projectStatusSchema = z.enum(PROJECT_STATUSES);

export const createProjectSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(255, "Name must be at most 255 characters"),
    description: z.string().max(5000, "Description must be at most 5000 characters").optional(),
    location: z.string().trim().max(255, "Location must be at most 255 characters").optional(),
    clientInfo: z.string().max(2000, "Client info must be at most 2000 characters").optional(),
    startDate: optionalDateSchema,
    expectedEndDate: optionalDateSchema,
    budget: z.coerce.number().nonnegative("Budget must be non-negative").max(9999999999.99, "Budget is too large").optional(),
    managerId: uuidSchema.optional(),
  })
  .strict();

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(255, "Name must be at most 255 characters").optional(),
    description: z.string().max(5000, "Description must be at most 5000 characters").optional(),
    location: z.string().trim().max(255, "Location must be at most 255 characters").optional(),
    clientInfo: z.string().max(2000, "Client info must be at most 2000 characters").optional(),
    startDate: optionalDateSchema,
    expectedEndDate: optionalDateSchema,
    actualEndDate: optionalDateSchema,
    budget: z.coerce.number().nonnegative("Budget must be non-negative").max(9999999999.99, "Budget is too large").optional(),
    status: projectStatusSchema.optional(),
    progressPercentage: z.number().int().min(0).max(100, "Progress percentage must be between 0 and 100").optional(),
    managerId: uuidSchema.nullable().optional(),
  })
  .strict();

export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export const projectIdParamsSchema = z.object({
  id: uuidSchema,
});

export const projectListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    status: projectStatusSchema.optional(),
    managerId: uuidSchema.optional(),
  })
  .strict();

export type ProjectListQuery = z.infer<typeof projectListQuerySchema>;

// Project status transition is enforced in the service layer.
export const PROJECT_STATUS_TRANSITIONS: Record<string, readonly string[]> = {
  PLANNING: ["ACTIVE", "ON_HOLD", "CANCELLED"],
  ACTIVE: ["ON_HOLD", "COMPLETED", "CANCELLED"],
  ON_HOLD: ["ACTIVE", "CANCELLED"],
  COMPLETED: ["CANCELLED"],
  CANCELLED: [],
};
