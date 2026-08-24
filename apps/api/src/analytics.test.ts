import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { agent as supertestAgent } from "supertest";

import { app } from "./app.js";
import { connectDatabase, prisma } from "./providers/database.js";
import {
  cleanupTestContext,
  setupTestContext,
  successBody,
  type Agent,
  type TestContext,
} from "./test-helpers.js";

interface DashboardData {
  projects: { total: number; active: number; completed: number; onHold: number };
  tasks: { total: number; todo: number; inProgress: number; blocked: number; completed: number };
  issues: { total: number; open: number; resolved: number };
  expenses: { pendingCount: number; pendingAmount: string; approvedAmount: string };
  materials: { total: number; lowStock: number };
}

interface ProgressItem {
  id: string;
  name: string;
  status: string;
  progressPercentage: number;
  taskTotal: number;
  taskCompleted: number;
}

let ctx: TestContext;
let admin: Agent;
let projectId: string;

beforeAll(async () => {
  ctx = await setupTestContext("ADMIN");
  admin = ctx.agent;
  projectId = ctx.project.id; // ACTIVE project with 0 tasks

  // Seed: 2 tasks (1 TODO, 1 COMPLETED), 1 issue, 1 material with stock, 1 pending expense.
  await admin.post(`/api/v1/projects/${projectId}/tasks`).send({ title: "Todo task" }).expect(201);
  const completedTask = await admin
    .post(`/api/v1/projects/${projectId}/tasks`)
    .send({ title: "Done task" });
  const completedId = successBody<{ id: string }>(completedTask).data.id;
  await admin
    .patch(`/api/v1/tasks/${completedId}/status`)
    .send({ status: "COMPLETED" })
    .expect(200);

  await admin
    .post("/api/v1/issues")
    .send({ projectId, title: "Open issue", description: "Issue for analytics" })
    .expect(201);

  const material = await admin
    .post("/api/v1/materials")
    .send({ name: "Analytics cement", unit: "bags", reorderLevel: 10 });
  const materialId = successBody<{ id: string }>(material).data.id;
  await admin
    .post(`/api/v1/materials/${materialId}/transactions`)
    .send({ type: "PURCHASE", quantity: 3 })
    .expect(201);

  await admin
    .post("/api/v1/expenses")
    .send({
      projectId,
      category: "MATERIALS",
      amount: 250,
      description: "Analytics expense",
      expenseDate: "2026-08-22",
    })
    .expect(201);
});

afterAll(async () => {
  await cleanupTestContext(ctx);
  await prisma.$disconnect();
});

describe("Analytics — dashboard", () => {
  it("returns accurate counts for the caller's company", async () => {
    const res = await admin.get("/api/v1/analytics/dashboard");
    expect(res.status).toBe(200);

    const stats = successBody<DashboardData>(res).data;
    expect(stats.projects.total).toBe(1);
    expect(stats.projects.active).toBe(1);
    expect(stats.tasks.total).toBe(2);
    expect(stats.tasks.todo).toBe(1);
    expect(stats.tasks.completed).toBe(1);
    expect(stats.issues.total).toBe(1);
    expect(stats.issues.open).toBe(1);
    expect(stats.expenses.pendingCount).toBe(1);
    expect(Number(stats.expenses.pendingAmount)).toBe(250);
    expect(stats.materials.total).toBe(1);
    expect(stats.materials.lowStock).toBe(1);
  });

  it("reflects expense review state", async () => {
    // Approve the seeded expense, then re-check dashboard aggregates.
    const list = await admin.get("/api/v1/expenses?status=PENDING");
    const pending = successBody<{ id: string }[]>(list).data[0];
    expect(pending).toBeDefined();
    await admin
      .patch(`/api/v1/expenses/${pending?.id ?? ""}/review`)
      .send({ status: "APPROVED" })
      .expect(200);

    const res = await admin.get("/api/v1/analytics/dashboard");
    const stats = successBody<DashboardData>(res).data;
    expect(stats.expenses.pendingCount).toBe(0);
    expect(Number(stats.expenses.approvedAmount)).toBe(250);
  });

  it("returns zeroed stats for an empty company", async () => {
    const empty = await setupTestContext("ADMIN");
    try {
      const res = await empty.agent.get("/api/v1/analytics/dashboard");
      expect(res.status).toBe(200);

      const stats = successBody<DashboardData>(res).data;
      expect(stats.projects.total).toBe(1); // setupTestContext creates one project
      expect(stats.tasks.total).toBe(0);
      expect(stats.issues.total).toBe(0);
      expect(stats.expenses.pendingCount).toBe(0);
      expect(stats.materials.total).toBe(0);
    } finally {
      await cleanupTestContext(empty);
    }
  });

  it("does not count another company's data", async () => {
    const other = await setupTestContext("ADMIN");
    try {
      await other.agent
        .post("/api/v1/issues")
        .send({
          projectId: other.project.id,
          title: "Foreign issue",
          description: "Should not count",
        })
        .expect(201);

      const res = await admin.get("/api/v1/analytics/dashboard");
      const stats = successBody<DashboardData>(res).data;
      expect(stats.issues.total).toBe(1); // still only our own seeded issue
    } finally {
      await cleanupTestContext(other);
    }
  });
});

describe("Analytics — project progress", () => {
  it("reports per-project task completion", async () => {
    const res = await admin.get("/api/v1/analytics/project-progress");
    expect(res.status).toBe(200);

    const items = successBody<ProgressItem[]>(res).data;
    const target = items.find((p) => p.id === projectId);
    expect(target).toBeDefined();
    expect(target?.taskTotal).toBe(2);
    expect(target?.taskCompleted).toBe(1);
  });
});

describe("Analytics — combined endpoint and auth", () => {
  it("returns both dashboard and project progress from /analytics", async () => {
    const res = await admin.get("/api/v1/analytics");
    expect(res.status).toBe(200);

    const data = successBody<{ dashboard: DashboardData; projectProgress: ProgressItem[] }>(res).data;
    expect(data.dashboard.projects.total).toBe(1);
    expect(data.projectProgress.some((p) => p.id === projectId)).toBe(true);
  });

  it("rejects unauthenticated requests with 401", async () => {
    expect((await supertestAgent(app).get("/api/v1/analytics")).status).toBe(401);
    expect((await supertestAgent(app).get("/api/v1/analytics/dashboard")).status).toBe(401);
    expect((await supertestAgent(app).get("/api/v1/analytics/project-progress")).status).toBe(401);
  });
});

describe("Health endpoint", () => {
  it("reports 503 unavailable without authentication when the database is not ready", async () => {
    const res = await supertestAgent(app).get("/api/v1/health");
    expect(res.status).toBe(503);
    expect(successBody<{ status: string; database: string }>(res).data.status).toBe("unavailable");
    expect(successBody<{ status: string; database: string }>(res).data.database).toBe("down");
  });

  it("reports ok once the database connection has succeeded", async () => {
    await connectDatabase();

    const res = await supertestAgent(app).get("/api/v1/health");
    expect(res.status).toBe(200);
    expect(successBody<{ status: string; database: string }>(res).data.status).toBe("ok");
    expect(successBody<{ status: string; database: string }>(res).data.database).toBe("up");
  });
});
