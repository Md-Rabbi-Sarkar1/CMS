import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { agent as supertestAgent } from "supertest";

import { app } from "./app.js";
import { prisma } from "./providers/database.js";
import {
  cleanupTestContext,
  createSecondUser,
  setupTestContext,
  successBody,
  type Agent,
  type TestContext,
  type TestUser,
} from "./test-helpers.js";

interface ExpenseData {
  id: string;
  projectId: string;
  category: string;
  amount: string;
  status: string;
  submittedBy: { id: string };
  reviewedBy: { id: string } | null;
  rejectionReason: string | null;
}

let ctx: TestContext;
let admin: Agent;
let pm: TestUser;
let pmAgent: Agent;
let engineer: TestUser;
let engineerAgent: Agent;
let worker: TestUser;
let workerAgent: Agent;

let projectId: string;

async function login(user: TestUser): Promise<Agent> {
  const agent = supertestAgent(app);
  await agent
    .post("/api/v1/auth/login")
    .send({ email: user.email, password: user.password })
    .expect(200);
  return agent;
}

async function createExpense(
  agent: Agent,
  description: string,
  amount = 100,
): Promise<string> {
  const res = await agent.post("/api/v1/expenses").send({
    projectId,
    category: "MATERIALS",
    amount,
    description,
    expenseDate: "2026-08-22",
  });
  expect(res.status).toBe(201);
  return successBody<ExpenseData>(res).data.id;
}

beforeAll(async () => {
  ctx = await setupTestContext("ADMIN");
  admin = ctx.agent;
  projectId = ctx.project.id;

  pm = await createSecondUser(ctx, "PROJECT_MANAGER");
  engineer = await createSecondUser(ctx, "ENGINEER");
  worker = await createSecondUser(ctx, "WORKER");

  pmAgent = await login(pm);
  engineerAgent = await login(engineer);
  workerAgent = await login(worker);
});

afterAll(async () => {
  await cleanupTestContext(ctx);
  await prisma.$disconnect();
});

describe("Expenses — create", () => {
  it("creates a PENDING expense attributed to the submitter", async () => {
    const id = await createExpense(workerAgent, "Worker expense");

    const stored = await prisma.expense.findUnique({ where: { id } });
    expect(stored?.status).toBe("PENDING");
    expect(stored?.submittedById).toBe(worker.id);
  });

  it("rejects invalid payloads with 400", async () => {
    const missingAmount = await admin.post("/api/v1/expenses").send({
      projectId,
      category: "MATERIALS",
      description: "No amount",
      expenseDate: "2026-08-22",
    });
    expect(missingAmount.status).toBe(400);

    const invalidCategory = await admin.post("/api/v1/expenses").send({
      projectId,
      category: "FOOD",
      amount: 10,
      description: "Bad category",
      expenseDate: "2026-08-22",
    });
    expect(invalidCategory.status).toBe(400);

    const negativeAmount = await admin.post("/api/v1/expenses").send({
      projectId,
      category: "OTHER",
      amount: -1,
      description: "Negative",
      expenseDate: "2026-08-22",
    });
    expect(negativeAmount.status).toBe(400);
  });

  it("rejects a non-existent project with 404 (ownership fix)", async () => {
    const res = await admin.post("/api/v1/expenses").send({
      projectId: "00000000-0000-0000-0000-000000000000",
      category: "OTHER",
      amount: 10,
      description: "Ghost project",
      expenseDate: "2026-08-22",
    });
    expect(res.status).toBe(404);
  });

  it("rejects a foreign-company project with 404 (ownership fix)", async () => {
    const other = await setupTestContext("ADMIN");
    try {
      const res = await admin.post("/api/v1/expenses").send({
        projectId: other.project.id,
        category: "OTHER",
        amount: 10,
        description: "Cross-tenant",
        expenseDate: "2026-08-22",
      });
      expect(res.status).toBe(404);
    } finally {
      await cleanupTestContext(other);
    }
  });

  it("rejects unauthenticated requests with 401", async () => {
    const res = await supertestAgent(app).get("/api/v1/expenses");
    expect(res.status).toBe(401);
  });
});

describe("Expenses — list and get", () => {
  let ownExpense: string;
  let otherExpense: string;

  beforeAll(async () => {
    ownExpense = await createExpense(engineerAgent, "Engineer expense");
    otherExpense = await createExpense(admin, "Admin expense");
  });

  it("lists company-wide expenses for every role (list is company-scoped)", async () => {
    // The expense list/get are company-scoped for all roles — only review and
    // delete have role/ownership restrictions.
    const res = await engineerAgent.get("/api/v1/expenses");
    expect(res.status).toBe(200);

    const ids = successBody<ExpenseData[]>(res).data.map((e) => e.id);
    expect(ids).toContain(ownExpense);
    expect(ids).toContain(otherExpense);
  });

  it("lists all company expenses for ADMIN and PROJECT_MANAGER", async () => {
    for (const agent of [admin, pmAgent]) {
      const res = await agent.get("/api/v1/expenses");
      expect(res.status).toBe(200);
      const ids = successBody<ExpenseData[]>(res).data.map((e) => e.id);
      expect(ids).toContain(ownExpense);
      expect(ids).toContain(otherExpense);
    }
  });

  it("returns any company expense by ID regardless of role", async () => {
    const res = await engineerAgent.get(`/api/v1/expenses/${otherExpense}`);
    expect(res.status).toBe(200);
    expect(successBody<ExpenseData>(res).data.id).toBe(otherExpense);
  });

  it("returns 404 for a non-existent expense", async () => {
    const res = await admin.get("/api/v1/expenses/00000000-0000-0000-0000-000000000000");
    expect(res.status).toBe(404);
  });
});

describe("Expenses — review workflow", () => {
  it("approves a PENDING expense as PROJECT_MANAGER and records the reviewer", async () => {
    const id = await createExpense(workerAgent, "Approve me");
    const res = await pmAgent.patch(`/api/v1/expenses/${id}/review`).send({ status: "APPROVED" });
    expect(res.status).toBe(200);

    const expense = successBody<ExpenseData>(res).data;
    expect(expense.status).toBe("APPROVED");
    expect(expense.reviewedBy?.id).toBe(pm.id);
  });

  it("rejects a PENDING expense with a reason as ADMIN", async () => {
    const id = await createExpense(engineerAgent, "Reject me");
    const res = await admin
      .patch(`/api/v1/expenses/${id}/review`)
      .send({ status: "REJECTED", rejectionReason: "Receipt missing" });
    expect(res.status).toBe(200);

    const expense = successBody<ExpenseData>(res).data;
    expect(expense.status).toBe("REJECTED");
    expect(expense.rejectionReason).toBe("Receipt missing");
  });

  it("rejects an invalid review status with 400", async () => {
    const id = await createExpense(admin, "Bad review status");
    const res = await admin.patch(`/api/v1/expenses/${id}/review`).send({ status: "PENDING" });
    expect(res.status).toBe(400);
  });

  it("rejects re-reviewing an already-reviewed expense with 409", async () => {
    const id = await createExpense(admin, "Double review");
    await admin.patch(`/api/v1/expenses/${id}/review`).send({ status: "APPROVED" }).expect(200);

    const res = await admin.patch(`/api/v1/expenses/${id}/review`).send({ status: "REJECTED" });
    expect(res.status).toBe(409);
  });

  it("returns 404 when reviewing a non-existent expense", async () => {
    const res = await admin
      .patch("/api/v1/expenses/00000000-0000-0000-0000-000000000000/review")
      .send({ status: "APPROVED" });
    expect(res.status).toBe(404);
  });
});

describe("Expenses — delete (owner rules)", () => {
  it("allows the owner to delete their own PENDING expense", async () => {
    const id = await createExpense(workerAgent, "Owner delete");
    const res = await workerAgent.delete(`/api/v1/expenses/${id}`);
    expect(res.status).toBe(200);

    const stored = await prisma.expense.findUnique({ where: { id } });
    expect(stored).toBeNull();
  });

  it("allows ADMIN to delete any PENDING expense", async () => {
    const id = await createExpense(workerAgent, "Admin delete");
    const res = await admin.delete(`/api/v1/expenses/${id}`);
    expect(res.status).toBe(200);
  });

  it("forbids a non-owner non-approver from deleting someone else's PENDING expense", async () => {
    const id = await createExpense(admin, "Not yours");
    const res = await workerAgent.delete(`/api/v1/expenses/${id}`);
    expect(res.status).toBe(403);
  });

  it("allows the owner to delete their own APPROVED expense", async () => {
    // Delete has no status restriction — only ADMIN-or-owner is enforced.
    const id = await createExpense(workerAgent, "Approved delete");
    await admin.patch(`/api/v1/expenses/${id}/review`).send({ status: "APPROVED" }).expect(200);

    const ownerRes = await workerAgent.delete(`/api/v1/expenses/${id}`);
    expect(ownerRes.status).toBe(200);

    const stored = await prisma.expense.findUnique({ where: { id } });
    expect(stored).toBeNull();
  });
});
