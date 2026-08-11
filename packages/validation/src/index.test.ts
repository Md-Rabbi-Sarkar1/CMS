import { describe, expect, it } from "vitest";

import {
  acceptInvitationSchema,
  createInvitationSchema,
  listUsersQuerySchema,
  loginSchema,
  paginationQuerySchema,
  updateCompanySchema,
  updateUserSchema,
} from "./index.js";

describe("validation package", () => {
  it("applies pagination defaults", () => {
    const result = paginationQuerySchema.parse({});

    expect(result).toEqual({ page: 1, pageSize: 20 });
  });

  it("accepts valid login credentials", () => {
    const result = loginSchema.safeParse({
      email: "admin@demo.local",
      password: "Password123!",
    });

    expect(result.success).toBe(true);
  });

  it("rejects an invalid email", () => {
    const result = loginSchema.safeParse({
      email: "not-an-email",
      password: "Password123!",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a short password", () => {
    const result = loginSchema.safeParse({
      email: "admin@demo.local",
      password: "short",
    });

    expect(result.success).toBe(false);
  });

  it("accepts a partial company update", () => {
    const result = updateCompanySchema.safeParse({
      name: "Demo Construction Co.",
      contactInfo: "contact@demo.local",
    });

    expect(result.success).toBe(true);
  });

  it("allows clearing nullable company fields with null", () => {
    const result = updateCompanySchema.safeParse({
      logoUrl: null,
      address: null,
    });

    expect(result.success).toBe(true);
    expect(result.success && result.data.logoUrl).toBeNull();
  });

  it("rejects an empty company name", () => {
    const result = updateCompanySchema.safeParse({ name: "  " });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid logo URL", () => {
    const result = updateCompanySchema.safeParse({ logoUrl: "not-a-url" });

    expect(result.success).toBe(false);
  });

  it("accepts an empty update object", () => {
    const result = updateCompanySchema.safeParse({});

    expect(result.success).toBe(true);
  });

  it("accepts a valid invitation", () => {
    const result = createInvitationSchema.safeParse({
      email: "worker@demo.local",
      role: "WORKER",
    });

    expect(result.success).toBe(true);
  });

  it("rejects an invalid invitation email", () => {
    const result = createInvitationSchema.safeParse({
      email: "not-an-email",
      role: "ADMIN",
    });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid invitation role", () => {
    const result = createInvitationSchema.safeParse({
      email: "worker@demo.local",
      role: "SUPERVISOR",
    });

    expect(result.success).toBe(false);
  });

  it("accepts a valid invitation acceptance", () => {
    const result = acceptInvitationSchema.safeParse({
      token: "some-invite-token",
      password: "Password123!",
    });

    expect(result.success).toBe(true);
  });

  it("rejects a missing invitation token", () => {
    const result = acceptInvitationSchema.safeParse({
      password: "Password123!",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a short invitation acceptance password", () => {
    const result = acceptInvitationSchema.safeParse({
      token: "some-invite-token",
      password: "short",
    });

    expect(result.success).toBe(false);
  });

  it("accepts a role-only user update", () => {
    const result = updateUserSchema.safeParse({ role: "PROJECT_MANAGER" });

    expect(result.success).toBe(true);
  });

  it("accepts a status-only user update", () => {
    const result = updateUserSchema.safeParse({ status: "INACTIVE" });

    expect(result.success).toBe(true);
  });

  it("accepts an empty user update object", () => {
    const result = updateUserSchema.safeParse({});

    expect(result.success).toBe(true);
  });

  it("rejects an invalid user role", () => {
    const result = updateUserSchema.safeParse({ role: "OWNER" });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid user status", () => {
    const result = updateUserSchema.safeParse({ status: "DELETED" });

    expect(result.success).toBe(false);
  });

  it("applies user list query defaults and accepts filters", () => {
    const result = listUsersQuerySchema.parse({
      search: "  alex  ",
      role: "ADMIN",
      status: "ACTIVE",
    });

    expect(result).toEqual({ page: 1, pageSize: 20, search: "alex", role: "ADMIN", status: "ACTIVE" });
  });

  it("rejects an invalid user list role filter", () => {
    const result = listUsersQuerySchema.safeParse({ role: "SUPERVISOR" });

    expect(result.success).toBe(false);
  });
});
