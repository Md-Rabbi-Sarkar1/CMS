import { describe, expect, it } from "vitest";

import { loginSchema, paginationQuerySchema, updateCompanySchema } from "./index.js";

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
});
