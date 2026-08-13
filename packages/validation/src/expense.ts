import { z } from "zod";

import { EXPENSE_CATEGORIES, EXPENSE_STATUSES } from "@construction-ops/shared";

import { uuidSchema, dateSchema } from "./common.js";

const expenseCategorySchema = z.enum(EXPENSE_CATEGORIES);
const expenseStatusSchema = z.enum(EXPENSE_STATUSES);

export const createExpenseSchema = z
  .object({
    projectId: uuidSchema,
    category: expenseCategorySchema,
    amount: z.coerce.number().positive("Amount must be positive").max(9999999999.99, "Amount is too large"),
    description: z.string().trim().min(1, "Description is required").max(2000, "Description must be at most 2000 characters"),
    expenseDate: dateSchema,
  })
  .strict();

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

export const expenseReviewSchema = z
  .object({
    status: z.enum([EXPENSE_STATUSES[1], EXPENSE_STATUSES[2]]),
    rejectionReason: z.string().max(2000, "Rejection reason must be at most 2000 characters").optional(),
  })
  .strict();

export type ExpenseReviewInput = z.infer<typeof expenseReviewSchema>;

export const expenseIdParamsSchema = z.object({
  id: uuidSchema,
});

export const expenseListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    projectId: uuidSchema.optional(),
    status: expenseStatusSchema.optional(),
    category: expenseCategorySchema.optional(),
  })
  .strict();

export type ExpenseListQuery = z.infer<typeof expenseListQuerySchema>;
