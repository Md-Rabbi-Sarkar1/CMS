import { z } from "zod";

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export const loginSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const updateCompanySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Company name is required")
    .max(255, "Company name must be at most 255 characters")
    .optional(),
  logoUrl: z
    .union([z.string().url("Invalid URL").max(2048, "Logo URL must be at most 2048 characters"), z.null()])
    .optional(),
  contactInfo: z
    .union([z.string().trim().max(500, "Contact info must be at most 500 characters"), z.null()])
    .optional(),
  address: z
    .union([z.string().trim().max(1000, "Address must be at most 1000 characters"), z.null()])
    .optional(),
});

export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;
