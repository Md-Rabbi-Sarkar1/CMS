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

export * from "./reports.js";
export * from "./common.js";
export * from "./company.js";
export * from "./user.js";
export * from "./project.js";
export * from "./task.js";
export * from "./material.js";
export * from "./expense.js";
export * from "./issue.js";
export * from "./document.js";
export * from "./notification.js";
