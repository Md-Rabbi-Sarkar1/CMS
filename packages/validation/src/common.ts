import { z } from "zod";

export const uuidSchema = z.string().uuid("Id must be a valid UUID");

export const idParamsSchema = z.object({
  id: uuidSchema,
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export const dateSchema = z
  .string()
  .trim()
  .min(1, "Date is required")
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Date must be a valid ISO date",
  });

export const optionalDateSchema = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Date must be a valid ISO date",
  })
  .optional();
