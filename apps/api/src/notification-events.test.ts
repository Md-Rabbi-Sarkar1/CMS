import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { agent as supertestAgent } from "supertest";

import { prisma } from "./providers/database.js";
import { app } from "./app.js";
import {
  cleanupTestContext,
  createSecondUser,
  setupTestContext,
  successBody,
  type TestContext,
  type TestUser,
} from "./test-helpers.js";

interface NotificationItem {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
}

let ctx: TestContext;
let manager: TestUser;
let worker: TestUser;
let managerAgent: ReturnType<typeof supertestAgent>;
let workerAgent: ReturnType<typeof supertestAgent>;
let managerName = "";

async function loginAgent(user: TestUser): Promise<ReturnType<typeof supertestAgent>> {
  const agent = supertestAgent(app);
  await agent
    .post("/api/v1/auth/login")
    .send({ email: user.email, password: user.password })
    .expect(200);
  return agent;
}

async function notificationsOf(agent: ReturnType<typeof supertestAgent>): Promise<NotificationItem[]> {
  const res = await agent.get("/api/v1/notifications?pageSize=100");
  expect(res.status).toBe(200);
  return successBody<NotificationItem[]>(res).data;
}

function findByType(items: NotificationItem[], type: string): NotificationItem | undefined {
  return items.find((n) => n.type === type);
}

beforeAll(async () => {
  ctx = await setupTestContext("ADMIN");
  manager = await createSecondUser(ctx, "PROJECT_MANAGER");
  worker = await createSecondUser(ctx, "WORKER");
  managerAgent = await loginAgent(manager);
  workerAgent = await loginAgent(worker);

  await prisma.project.update({
    where: { id: ctx.project.id },
    data: { managerId: manager.id },
  });

  managerName =
    (await prisma.user.findUnique({ where: { id: manager.id }, select: { name: true } }))?.name ?? "";
});

afterAll(async () => {
  await cleanupTestContext(ctx);
  await prisma.$disconnect();
});

describe("Notification HTTP — authentication", () => {
  it("rejects unauthenticated list with 401", async () => {
    const unauth = supertestAgent(app);
    const res = await unauth.get("/api/v1/notifications");
    expect(res.status).toBe(401);
  });

  it("rejects unauthenticated read operations with 401", async () => {
    const unauth = supertestAgent(app);

    const read = await unauth.post("/api/v1/notifications/11111111-1111-1111-1111-111111111111/read");
    expect(read.status).toBe(401);

    const markAll = await unauth.post("/api/v1/notifications/mark-all-read");
    expect(markAll.status).toBe(401);

    const count = await unauth.get("/api/v1/notifications/unread-count");
    expect(count.status).toBe(401);
  });
});

describe("Notification events — task assignment and deadline", () => {
  it("notifies the assignee when a task is created with an assignee", async () => {
    const title = `Wire the lobby ${String(Date.now())}`;
    const res = await ctx.agent
      .post(`/api/v1/projects/${ctx.project.id}/tasks`)
      .send({ title, assigneeId: manager.id });

    expect(res.status).toBe(201);

    const managerInbox = await notificationsOf(managerAgent);
    const notification = findByType(managerInbox, "TASK_ASSIGNED");
    expect(notification).toBeTruthy();
    expect(notification?.title).toBe(`Task assigned: ${title}`);
    expect(notification?.message).toContain(ctx.project.name);
    expect(notification?.userId).toBe(manager.id);
    expect(notification?.readAt).toBeNull();

    const adminInbox = await notificationsOf(ctx.agent);
    expect(findByType(adminInbox, "TASK_ASSIGNED")).toBeUndefined();
  });

  it("notifies the assignee when a task is reassigned to them", async () => {
    const created = await ctx.agent
      .post(`/api/v1/projects/${ctx.project.id}/tasks`)
      .send({ title: `Inspect the roof ${String(Date.now())}` });
    expect(created.status).toBe(201);
    const taskId = successBody<{ id: string }>(created).data.id;

    const updated = await managerAgent.patch(`/api/v1/tasks/${taskId}`).send({ assigneeId: worker.id });
    expect(updated.status).toBe(200);

    const workerInbox = await notificationsOf(workerAgent);
    const notification = findByType(workerInbox, "TASK_ASSIGNED");
    expect(notification).toBeTruthy();
    expect(notification?.userId).toBe(worker.id);
  });

  it("notifies the assignee about an approaching deadline", async () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const res = await ctx.agent
      .post(`/api/v1/projects/${ctx.project.id}/tasks`)
      .send({ title: `Pour slab ${String(Date.now())}`, assigneeId: worker.id, dueDate: tomorrow });
    expect(res.status).toBe(201);

    const workerInbox = await notificationsOf(workerAgent);
    const deadline = findByType(workerInbox, "TASK_DEADLINE");
    expect(deadline).toBeTruthy();
    expect(deadline?.message).toContain(tomorrow);

    const assigned = findByType(workerInbox, "TASK_ASSIGNED");
    expect(assigned).toBeTruthy();
  });

  it("does not emit a deadline notification for far future due dates", async () => {
    const farFuture = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const title = `Plan phase two ${String(Date.now())}`;
    const res = await ctx.agent
      .post(`/api/v1/projects/${ctx.project.id}/tasks`)
      .send({ title, assigneeId: worker.id, dueDate: farFuture });
    expect(res.status).toBe(201);

    const workerInbox = await notificationsOf(workerAgent);
    const forThisTask = workerInbox.filter((n) => n.title.includes(title));
    expect(forThisTask).toHaveLength(1);
    expect(forThisTask[0]?.type).toBe("TASK_ASSIGNED");
  });
});

describe("Notification events — reports, issues, expenses, documents", () => {
  it("notifies manager and admins when a daily report is submitted, excluding the submitter", async () => {
    const res = await managerAgent.post("/api/v1/reports").send({
      projectId: ctx.project.id,
      reportDate: "2026-08-20",
      workCompleted: "Set formwork for level two.",
      hoursWorked: 8,
      progressPct: 45,
      workers: [{ name: "Alice", role: "Mason", hoursWorked: 8 }],
    });
    expect(res.status).toBe(201);

    const adminInbox = await notificationsOf(ctx.agent);
    const notification = findByType(adminInbox, "REPORT_SUBMITTED");
    expect(notification).toBeTruthy();
    expect(notification?.title).toBe(`New daily report: ${ctx.project.name}`);
    expect(notification?.message).toContain(managerName);

    const managerInbox = await notificationsOf(managerAgent);
    expect(findByType(managerInbox, "REPORT_SUBMITTED")).toBeUndefined();
  });

  it("notifies reviewers and the assignee when an issue is created", async () => {
    const title = `Broken scaffold ${String(Date.now())}`;
    const res = await managerAgent.post("/api/v1/issues").send({
      projectId: ctx.project.id,
      title,
      description: "Scaffold platform on level two is damaged.",
      assigneeId: worker.id,
    });
    expect(res.status).toBe(201);

    const adminInbox = await notificationsOf(ctx.agent);
    const adminNotified = findByType(adminInbox, "ISSUE_CREATED");
    expect(adminNotified).toBeTruthy();
    expect(adminNotified?.title).toBe(`New issue: ${title}`);

    const workerInbox = await notificationsOf(workerAgent);
    const workerNotified = findByType(workerInbox, "ISSUE_CREATED");
    expect(workerNotified).toBeTruthy();
    expect(workerNotified?.userId).toBe(worker.id);
  });

  it("notifies reviewers when an expense is submitted", async () => {
    const res = await managerAgent.post("/api/v1/expenses").send({
      projectId: ctx.project.id,
      category: "MATERIALS",
      amount: 1250.5,
      description: "Cement and rebar purchase",
      expenseDate: "2026-08-20",
    });
    expect(res.status).toBe(201);

    const adminInbox = await notificationsOf(ctx.agent);
    const notification = findByType(adminInbox, "EXPENSE_PENDING");
    expect(notification).toBeTruthy();
    expect(notification?.message).toContain(managerName);
    expect(notification?.message).toContain(ctx.project.name);
  });

  it("notifies reviewers when a document is uploaded", async () => {
    const name = `Permit ${String(Date.now())}.pdf`;
    const res = await managerAgent.post("/api/v1/documents").send({
      projectId: ctx.project.id,
      name,
      type: "PERMIT",
      mimeType: "application/pdf",
      sizeBytes: 1024,
    });
    expect(res.status).toBe(201);

    const adminInbox = await notificationsOf(ctx.agent);
    const notification = findByType(adminInbox, "DOCUMENT_UPLOADED");
    expect(notification).toBeTruthy();
    expect(notification?.title).toBe(`New document: ${name}`);
  });
});

describe("Notification events — project assignment and low stock", () => {
  it("notifies a user when they are added to a project", async () => {
    const res = await ctx.agent
      .post(`/api/v1/projects/${ctx.project.id}/members`)
      .send({ userId: worker.id });
    expect(res.status).toBe(201);

    const workerInbox = await notificationsOf(workerAgent);
    const notification = findByType(workerInbox, "PROJECT_ASSIGNMENT");
    expect(notification).toBeTruthy();
    expect(notification?.title).toBe(`Added to project: ${ctx.project.name}`);
    expect(notification?.userId).toBe(worker.id);
  });

  it("notifies managers when a material is created at or below reorder level", async () => {
    const name = `Rebar ${String(Date.now())}`;
    const res = await ctx.agent.post("/api/v1/materials").send({
      name,
      unit: "tons",
      currentStock: 5,
      reorderLevel: 5,
    });
    expect(res.status).toBe(201);

    const adminInbox = await notificationsOf(ctx.agent);
    const notification = findByType(adminInbox, "LOW_STOCK");
    expect(notification).toBeTruthy();
    expect(notification?.title).toBe(`Low stock: ${name}`);

    const managerInbox = await notificationsOf(managerAgent);
    expect(findByType(managerInbox, "LOW_STOCK")).toBeTruthy();

    const workerInbox = await notificationsOf(workerAgent);
    expect(findByType(workerInbox, "LOW_STOCK")).toBeUndefined();
  });

  it("notifies on usage transactions and suppresses unread duplicates until read", async () => {
    const name = `Gravel ${String(Date.now())}`;
    const created = await ctx.agent.post("/api/v1/materials").send({
      name,
      unit: "tons",
      currentStock: 10,
      reorderLevel: 8,
    });
    expect(created.status).toBe(201);
    const materialId = successBody<{ id: string }>(created).data.id;
    const title = `Low stock: ${name}`;

    const adminBefore = await notificationsOf(ctx.agent);
    expect(adminBefore.some((n) => n.type === "LOW_STOCK" && n.title === title)).toBe(false);

    const tx1 = await ctx.agent
      .post(`/api/v1/materials/${materialId}/transactions`)
      .send({ type: "USAGE", quantity: 4 });
    expect(tx1.status).toBe(201);

    const adminAfter = await notificationsOf(ctx.agent);
    const notified = adminAfter.find((n) => n.type === "LOW_STOCK" && n.title === title);
    expect(notified).toBeTruthy();

    // Second transaction while the first low-stock notification is unread: no duplicate.
    const tx2 = await ctx.agent
      .post(`/api/v1/materials/${materialId}/transactions`)
      .send({ type: "USAGE", quantity: 1 });
    expect(tx2.status).toBe(201);

    const lowStockRows = await prisma.notification.findMany({
      where: { userId: ctx.user.id, type: "LOW_STOCK", title: `Low stock: ${name}` },
    });
    expect(lowStockRows).toHaveLength(1);

    // After marking all read, a new low-stock event notifies again.
    await ctx.agent.post("/api/v1/notifications/mark-all-read").expect(200);

    const tx3 = await ctx.agent
      .post(`/api/v1/materials/${materialId}/transactions`)
      .send({ type: "USAGE", quantity: 1 });
    expect(tx3.status).toBe(201);

    const rowsAfterAll = await prisma.notification.findMany({
      where: { userId: ctx.user.id, type: "LOW_STOCK", title: `Low stock: ${name}` },
    });
    expect(rowsAfterAll).toHaveLength(2);
  });
});

describe("Notification endpoints — read state", () => {
  it("reports unread count, marks one read, and filters unreadOnly", async () => {
    const create = await ctx.agent
      .post(`/api/v1/projects/${ctx.project.id}/tasks`)
      .send({ title: `Mark one read ${String(Date.now())}`, assigneeId: manager.id });
    expect(create.status).toBe(201);

    const count = await managerAgent.get("/api/v1/notifications/unread-count");
    expect(count.status).toBe(200);
    const unreadBefore = successBody<{ unread: number }>(count).data.unread;
    expect(unreadBefore).toBeGreaterThanOrEqual(1);

    const inbox = await notificationsOf(managerAgent);
    const target = inbox.find((n) => n.readAt === null);
    expect(target).toBeTruthy();

    if (target) {
      const read = await managerAgent.post(`/api/v1/notifications/${target.id}/read`);
      expect(read.status).toBe(200);
      expect(successBody<NotificationItem>(read).data.readAt).not.toBeNull();
    }

    const unreadOnly = await managerAgent.get("/api/v1/notifications?unreadOnly=true");
    expect(unreadOnly.status).toBe(200);
    const unreadItems = successBody<NotificationItem[]>(unreadOnly).data;
    for (const item of unreadItems) {
      expect(item.readAt).toBeNull();
    }
  });

  it("marks all notifications as read", async () => {
    const res = await managerAgent.post("/api/v1/notifications/mark-all-read");
    expect(res.status).toBe(200);
    expect(successBody<{ updated: number }>(res).data.updated).toBeGreaterThanOrEqual(1);

    const count = await managerAgent.get("/api/v1/notifications/unread-count");
    expect(successBody<{ unread: number }>(count).data.unread).toBe(0);
  });

  it("does not let a user read another user's notification", async () => {
    const create = await ctx.agent
      .post(`/api/v1/projects/${ctx.project.id}/tasks`)
      .send({ title: `Isolation ${String(Date.now())}`, assigneeId: worker.id });
    expect(create.status).toBe(201);

    const workerInbox = await notificationsOf(workerAgent);
    const target = workerInbox.find((n) => n.type === "TASK_ASSIGNED" && n.readAt === null);
    expect(target).toBeTruthy();

    if (target) {
      const read = await managerAgent.post(`/api/v1/notifications/${target.id}/read`);
      expect(read.status).toBe(404);
    }
  });

  it("returns 404 for unknown notifications", async () => {
    const res = await ctx.agent.post("/api/v1/notifications/11111111-1111-1111-1111-111111111111/read");
    expect(res.status).toBe(404);
  });
});

describe("Notification tenant isolation", () => {
  it("does not leak generated notifications across companies", async () => {
    const other = await setupTestContext("ADMIN");
    try {
      const otherInbox = await notificationsOf(other.agent);
      expect(otherInbox).toHaveLength(0);
    } finally {
      await cleanupTestContext(other);
    }
  });
});
