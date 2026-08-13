import { z } from "zod";

import { COMPANY_ROLES } from "@construction-ops/shared";

import { uuidSchema } from "./common.js";

const companyRoleSchema = z.enum(COMPANY_ROLES);

export const inviteUserSchema = z
  .object({
    email: z.string().trim().min(1, "Email is required").email("Invalid email address"),
    role: companyRoleSchema,
    name: z.string().trim().min(1, "Name is required").max(255, "Name must be at most 255 characters"),
  })
  .strict();

export type InviteUserInput = z.infer<typeof inviteUserSchema>;

export const updateUserSchema = z
  .object({
    role: companyRoleSchema.optional(),
  })
  .strict();

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const userIdParamsSchema = z.object({
  id: uuidSchema,
});

export const userListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    role: companyRoleSchema.optional(),
  })
  .strict();

export type UserListQuery = z.infer<typeof userListQuerySchema>;

export const acceptInviteSchema = z
  .object({
    token: z.string().trim().min(1, "Token is required"),
    name: z.string().trim().min(1, "Name is required").max(255, "Name must be at most 255 characters"),
    password: z.string().min(8, "Password must be at least 8 characters").max(128, "Password is too long"),
  })
  .strict();

export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;

export const inviteTokenParamsSchema = z.object({
  token: z.string().min(1, "Token is required"),
});
