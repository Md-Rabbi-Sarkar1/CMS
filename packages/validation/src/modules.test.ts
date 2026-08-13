import { describe, expect, it } from "vitest";

import {
  acceptInviteSchema,
  createDocumentSchema,
  createExpenseSchema,
  createIssueSchema,
  createMaterialSchema,
  createProjectSchema,
  createTaskSchema,
  expenseReviewSchema,
  inviteUserSchema,
  inventoryTxSchema,
  taskStatusTransitionSchema,
  updateCompanySchema,
  updateIssueSchema,
  updateMaterialSchema,
  updateProjectSchema,
  updateUserSchema,
} from "./index.js";

const UUID = "11111111-1111-1111-1111-111111111111";

describe("company validation", () => {
  it("accepts a valid company update", () => {
    expect(updateCompanySchema.safeParse({ name: "Acme" }).success).toBe(true);
  });

  it("rejects an invalid logo url", () => {
    expect(updateCompanySchema.safeParse({ logoUrl: "not-a-url" }).success).toBe(false);
  });

  it("rejects extra fields", () => {
    expect(updateCompanySchema.safeParse({ name: "Acme", extra: 1 }).success).toBe(false);
  });
});

describe("user/invitation validation", () => {
  it("accepts a valid invite", () => {
    expect(
      inviteUserSchema.safeParse({ email: "a@b.co", role: "ENGINEER", name: "Sam" }).success,
    ).toBe(true);
  });

  it("rejects an invalid role", () => {
    expect(
      inviteUserSchema.safeParse({ email: "a@b.co", role: "SUPERUSER", name: "Sam" }).success,
    ).toBe(false);
  });

  it("accepts a valid accept-invite payload", () => {
    expect(
      acceptInviteSchema.safeParse({ token: "t", name: "Sam", password: "password123" }).success,
    ).toBe(true);
  });

  it("rejects a short password on accept", () => {
    expect(
      acceptInviteSchema.safeParse({ token: "t", name: "Sam", password: "short" }).success,
    ).toBe(false);
  });

  it("accepts updating only role", () => {
    expect(updateUserSchema.safeParse({ role: "WORKER" }).success).toBe(true);
  });

  it("rejects extra fields on user update", () => {
    expect(updateUserSchema.safeParse({ role: "WORKER", name: "x" }).success).toBe(false);
  });
});

describe("project validation", () => {
  it("accepts a minimal project", () => {
    expect(createProjectSchema.safeParse({ name: "Tower" }).success).toBe(true);
  });

  it("accepts a full project", () => {
    expect(
      createProjectSchema.safeParse({
        name: "Tower",
        description: "desc",
        location: "Site",
        clientInfo: "Client",
        startDate: "2026-01-01",
        expectedEndDate: "2026-12-31",
        budget: 100000,
        managerId: UUID,
      }).success,
    ).toBe(true);
  });

  it("rejects a negative budget", () => {
    expect(createProjectSchema.safeParse({ name: "Tower", budget: -5 }).success).toBe(false);
  });

  it("rejects an invalid status on update", () => {
    expect(updateProjectSchema.safeParse({ status: "WRONG" }).success).toBe(false);
  });

  it("rejects progress out of range", () => {
    expect(updateProjectSchema.safeParse({ progressPercentage: 150 }).success).toBe(false);
  });

  it("accepts a nullable managerId on update", () => {
    expect(updateProjectSchema.safeParse({ managerId: null }).success).toBe(true);
  });
});

describe("task validation", () => {
  it("accepts a minimal task", () => {
    expect(createTaskSchema.safeParse({ title: "Pour concrete" }).success).toBe(true);
  });

  it("rejects an empty title", () => {
    expect(createTaskSchema.safeParse({ title: "  " }).success).toBe(false);
  });

  it("accepts a valid status transition payload", () => {
    expect(taskStatusTransitionSchema.safeParse({ status: "IN_PROGRESS" }).success).toBe(true);
  });

  it("rejects an invalid priority", () => {
    expect(createTaskSchema.safeParse({ title: "T", priority: "CRITICAL" }).success).toBe(false);
  });
});

describe("material validation", () => {
  it("accepts a valid material", () => {
    expect(createMaterialSchema.safeParse({ name: "Cement", unit: "bags" }).success).toBe(true);
  });

  it("rejects a negative current stock", () => {
    expect(
      createMaterialSchema.safeParse({ name: "Cement", unit: "bags", currentStock: -1 }).success,
    ).toBe(false);
  });

  it("accepts partial update", () => {
    expect(updateMaterialSchema.safeParse({ reorderLevel: 10 }).success).toBe(true);
  });

  it("accepts a purchase transaction", () => {
    expect(inventoryTxSchema.safeParse({ type: "PURCHASE", quantity: 50 }).success).toBe(true);
  });

  it("rejects a non-positive quantity", () => {
    expect(inventoryTxSchema.safeParse({ type: "USAGE", quantity: 0 }).success).toBe(false);
  });

  it("rejects an invalid tx type", () => {
    expect(inventoryTxSchema.safeParse({ type: "TRANSFER", quantity: 5 }).success).toBe(false);
  });
});

describe("expense validation", () => {
  it("accepts a valid expense", () => {
    expect(
      createExpenseSchema.safeParse({
        projectId: "11111111-1111-1111-1111-111111111111",
        category: "LABOR",
        amount: 500,
        description: "Wages",
        expenseDate: "2026-08-12",
      }).success,
    ).toBe(true);
  });

  it("rejects a non-positive amount", () => {
    expect(
      createExpenseSchema.safeParse({
        projectId: "11111111-1111-1111-1111-111111111111",
        category: "LABOR",
        amount: 0,
        description: "Wages",
        expenseDate: "2026-08-12",
      }).success,
    ).toBe(false);
  });

  it("accepts an approval", () => {
    expect(expenseReviewSchema.safeParse({ status: "APPROVED" }).success).toBe(true);
  });

  it("accepts a rejection with reason", () => {
    expect(expenseReviewSchema.safeParse({ status: "REJECTED", rejectionReason: "No" }).success).toBe(true);
  });

  it("rejects a PENDING review status", () => {
    expect(expenseReviewSchema.safeParse({ status: "PENDING" }).success).toBe(false);
  });
});

describe("issue validation", () => {
  it("accepts a valid issue", () => {
    expect(
      createIssueSchema.safeParse({
        projectId: "11111111-1111-1111-1111-111111111111",
        title: "Crack",
        description: "Wall crack",
      }).success,
    ).toBe(true);
  });

  it("rejects an empty description", () => {
    expect(
      createIssueSchema.safeParse({
        projectId: "11111111-1111-1111-1111-111111111111",
        title: "Crack",
        description: "",
      }).success,
    ).toBe(false);
  });

  it("accepts a status update", () => {
    expect(updateIssueSchema.safeParse({ status: "RESOLVED", resolution: "Fixed" }).success).toBe(true);
  });

  it("rejects an invalid status", () => {
    expect(updateIssueSchema.safeParse({ status: "DONE" }).success).toBe(false);
  });
});

describe("document validation", () => {
  it("accepts a valid document", () => {
    expect(
      createDocumentSchema.safeParse({
        projectId: "11111111-1111-1111-1111-111111111111",
        name: "blueprint.pdf",
        type: "BLUEPRINT",
        mimeType: "application/pdf",
        sizeBytes: 1024,
      }).success,
    ).toBe(true);
  });

  it("rejects a negative size", () => {
    expect(
      createDocumentSchema.safeParse({
        projectId: "11111111-1111-1111-1111-111111111111",
        name: "blueprint.pdf",
        type: "BLUEPRINT",
        mimeType: "application/pdf",
        sizeBytes: -1,
      }).success,
    ).toBe(false);
  });
});
