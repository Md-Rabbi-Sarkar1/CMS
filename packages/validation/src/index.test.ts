import { describe, expect, it } from "vitest";

import { loginSchema, paginationQuerySchema } from "./index.js";

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
});
