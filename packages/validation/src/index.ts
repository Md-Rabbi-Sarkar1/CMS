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

export const companyRoleSchema = z.enum(["ADMIN", "PROJECT_MANAGER", "ENGINEER", "WORKER"]);

export type CompanyRole = z.infer<typeof companyRoleSchema>;

export const userStatusSchema = z.enum(["ACTIVE", "INACTIVE"]);

export type UserStatus = z.infer<typeof userStatusSchema>;

export const createInvitationSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Invalid email address"),
  role: companyRoleSchema,
});

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;

export const acceptInvitationSchema = z.object({
  token: z.string().trim().min(1, "Invitation token is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;

export const updateUserSchema = z.object({
  role: companyRoleSchema.optional(),
  status: userStatusSchema.optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const listUsersQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(255, "Search must be at most 255 characters").optional(),
  role: companyRoleSchema.optional(),
  status: userStatusSchema.optional(),
});

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;

export const projectStatusSchema = z.enum(["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"]);

export type ProjectStatus = z.infer<typeof projectStatusSchema>;

export const PROJECT_STATUS_TRANSITIONS: Record<ProjectStatus, readonly ProjectStatus[]> = {
  PLANNING: ["ACTIVE", "CANCELLED"],
  ACTIVE: ["ON_HOLD", "COMPLETED", "CANCELLED"],
  ON_HOLD: ["ACTIVE", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransitionProjectStatus(from: ProjectStatus, to: ProjectStatus): boolean {
  return PROJECT_STATUS_TRANSITIONS[from].includes(to);
}

export const createProjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Project name is required")
    .max(255, "Project name must be at most 255 characters"),
  description: z
    .string()
    .trim()
    .max(10000, "Description must be at most 10000 characters")
    .optional(),
  location: z
    .string()
    .trim()
    .max(255, "Location must be at most 255 characters")
    .optional(),
  clientInfo: z
    .string()
    .trim()
    .max(2000, "Client info must be at most 2000 characters")
    .optional(),
  startDate: z.string().date("Invalid start date").optional(),
  expectedEndDate: z.string().date("Invalid expected end date").optional(),
  budget: z.number().nonnegative("Budget must be non-negative").optional(),
  managerId: z.string().uuid("Invalid manager ID").optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Project name is required")
      .max(255, "Project name must be at most 255 characters")
      .optional(),
    description: z
      .union([z.string().trim().max(10000, "Description must be at most 10000 characters"), z.null()])
      .optional(),
    location: z
      .union([z.string().trim().max(255, "Location must be at most 255 characters"), z.null()])
      .optional(),
    clientInfo: z
      .union([z.string().trim().max(2000, "Client info must be at most 2000 characters"), z.null()])
      .optional(),
    startDate: z.union([z.string().date("Invalid start date"), z.null()]).optional(),
    expectedEndDate: z.union([z.string().date("Invalid expected end date"), z.null()]).optional(),
    budget: z.union([z.number().nonnegative("Budget must be non-negative"), z.null()]).optional(),
    managerId: z.union([z.string().uuid("Invalid manager ID"), z.null()]).optional(),
  })
  .superRefine((data, ctx) => {
    if (Object.keys(data).length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["body"],
        message: "At least one field must be provided",
      });
    }
  });

export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export const updateProjectStatusSchema = z.object({
  status: projectStatusSchema,
});

export type UpdateProjectStatusInput = z.infer<typeof updateProjectStatusSchema>;

export const updateProjectProgressSchema = z.object({
  progressPercentage: z
    .number()
    .int("Progress must be an integer")
    .min(0, "Progress must be between 0 and 100")
    .max(100, "Progress must be between 0 and 100"),
});

export type UpdateProjectProgressInput = z.infer<typeof updateProjectProgressSchema>;

export const projectSortSchema = z.enum([
  "createdAt:asc",
  "createdAt:desc",
  "name:asc",
  "name:desc",
  "startDate:asc",
  "startDate:desc",
]);

export type ProjectSort = z.infer<typeof projectSortSchema>;

export const listProjectsQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(255, "Search must be at most 255 characters").optional(),
  status: projectStatusSchema.optional(),
  sort: projectSortSchema.optional(),
});

export type ListProjectsQuery = z.infer<typeof listProjectsQuerySchema>;
