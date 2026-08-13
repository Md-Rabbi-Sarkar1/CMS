import { z } from "zod";

export const reportWorkerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Worker name is required")
    .max(255, "Worker name must be at most 255 characters"),
  role: z
    .string()
    .trim()
    .min(1, "Worker role cannot be empty")
    .max(255, "Worker role must be at most 255 characters")
    .optional(),
  hoursWorked: z
    .number()
    .nonnegative("Hours worked must be non-negative")
    .max(9999.99, "Hours worked must be at most 9999.99")
    .optional(),
});

export type ReportWorkerInput = z.infer<typeof reportWorkerSchema>;

export const createDailyWorkReportSchema = z
  .object({
    projectId: z.string().uuid("Project id must be a valid UUID"),
    reportDate: z
      .string()
      .trim()
      .min(1, "Report date is required")
      .refine((value) => !Number.isNaN(Date.parse(value)), {
        message: "Report date must be a valid ISO date",
      }),
    workCompleted: z
      .string()
      .trim()
      .min(1, "Work completed is required")
      .max(10000, "Work completed must be at most 10000 characters"),
    hoursWorked: z
      .number()
      .nonnegative("Hours worked must be non-negative")
      .max(9999.99, "Hours worked must be at most 9999.99"),
    materialsUsed: z
      .string()
      .max(10000, "Materials used must be at most 10000 characters")
      .optional(),
    progressPct: z
      .number()
      .int("Progress percentage must be an integer")
      .min(0, "Progress percentage must be between 0 and 100")
      .max(100, "Progress percentage must be between 0 and 100"),
    problemsEncountered: z
      .string()
      .max(10000, "Problems encountered must be at most 10000 characters")
      .optional(),
    notes: z
      .string()
      .max(10000, "Notes must be at most 10000 characters")
      .optional(),
    workers: z.array(reportWorkerSchema).min(1, "At least one worker is required").max(100, "A report can have at most 100 workers"),
  })
  .strict();

export type CreateDailyWorkReportInput = z.infer<typeof createDailyWorkReportSchema>;

export const updateDailyWorkReportSchema = z
  .object({
    reportDate: z
      .string()
      .trim()
      .min(1, "Report date is required")
      .refine((value) => !Number.isNaN(Date.parse(value)), {
        message: "Report date must be a valid ISO date",
      })
      .optional(),
    workCompleted: z
      .string()
      .trim()
      .min(1, "Work completed cannot be empty")
      .max(10000, "Work completed must be at most 10000 characters")
      .optional(),
    hoursWorked: z
      .number()
      .nonnegative("Hours worked must be non-negative")
      .max(9999.99, "Hours worked must be at most 9999.99")
      .optional(),
    materialsUsed: z
      .string()
      .max(10000, "Materials used must be at most 10000 characters")
      .optional(),
    progressPct: z
      .number()
      .int("Progress percentage must be an integer")
      .min(0, "Progress percentage must be between 0 and 100")
      .max(100, "Progress percentage must be between 0 and 100")
      .optional(),
    problemsEncountered: z
      .string()
      .max(10000, "Problems encountered must be at most 10000 characters")
      .optional(),
    notes: z
      .string()
      .max(10000, "Notes must be at most 10000 characters")
      .optional(),
    workers: z
      .array(reportWorkerSchema)
      .min(1, "At least one worker is required")
      .max(100, "A report can have at most 100 workers")
      .optional(),
  })
  .strict();

export type UpdateDailyWorkReportInput = z.infer<typeof updateDailyWorkReportSchema>;

export const reportIdParamsSchema = z.object({
  id: z.string().uuid("Report id must be a valid UUID"),
});

export const reportListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    projectId: z.string().uuid("Project id must be a valid UUID").optional(),
    submittedById: z.string().uuid("Submitted by id must be a valid UUID").optional(),
    reportDateFrom: z
      .string()
      .refine((value) => !Number.isNaN(Date.parse(value)), {
        message: "reportDateFrom must be a valid ISO date",
      })
      .optional(),
    reportDateTo: z
      .string()
      .refine((value) => !Number.isNaN(Date.parse(value)), {
        message: "reportDateTo must be a valid ISO date",
      })
      .optional(),
  })
  .strict();

export type ReportListQuery = z.infer<typeof reportListQuerySchema>;
