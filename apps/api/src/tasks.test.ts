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

interface TaskData {
  id: string;
  title: string;
  status: string;
  priority: string;
  assigneeId: string | null;
  projectId: string;
  completionDate: string | null;
}

let ctx: TestContext;
let admin: Agent;
let pm: TestUser;
let pmAgent: Agent;
let worker: TestUser;
let workerAgent: Agent;
let outsider: TestUser;
let outsiderAgent: Agent;

let projectId: string;

async function login(user: TestUser): Promise<Agent> {
  const agent = supertestAgent(app);
  await agent
    .post("/api/v1/auth/login")
    .send({ email: user.email, password: user.password })
    .expect(200);
  return agent;
}

async function createTask(
  agent: Agent,
  title: string,
  extra: Record<string, unknown> = {},
): Promise<string> {
  const res = await agent.post(`/api/v1/projects/${projectId}/tasks`).send({ title, ...extra });
  expect(res.status).toBe(201);
  return successBody<TaskData>(res).data.id;
}

beforeAll(async () => {
  ctx = await setupTestContext("ADMIN");
  admin = ctx.agent;
  projectId = ctx.project.id;

  pm = await createSecondUser(ctx, "PROJECT_MANAGER");
  worker = await createSecondUser(ctx, "WORKER");
  outsider = await createSecondUser(ctx, "ENGINEER");

  pmAgent = await login(pm);
  workerAgent = await login(worker);
  outsiderAgent = await login(outsider);

  // PM manages; worker is a member; outsider has no access.
  await admin.patch(`/api/v1/projects/${projectId}`).send({ managerId: pm.id }).expect(200);
  await admin.post(`/api/v1/projects/${projectId}/members`).send({ userId: worker.id }).expect(201);
});

afterAll(async () => {
  await cleanupTestContext(ctx);
  await prisma.$disconnect();
});

describe("Tasks — create", () => {
  it("creates a task with defaults", async () => {
    const res = await admin.post(`/api/v1/projects/${projectId}/tasks`).send({ title: "First task" });
    expect(res.status).toBe(201);

    const task = successBody<TaskData>(res).data;
    expect(task.status).toBe("TODO");
    expect(task.projectId).toBe(projectId);
  });

  it("creates a task with an assignee", async () => {
    const res = await admin
      .post(`/api/v1/projects/${projectId}/tasks`)
      .send({ title: "Assigned task", assigneeId: worker.id, priority: "HIGH" });
    expect(res.status).toBe(201);

    const task = successBody<TaskData>(res).data;
    expect(task.assigneeId).toBe(worker.id);
    expect(task.priority).toBe("HIGH");
  });

  it("rejects a missing title with 400", async () => {
    const res = await admin.post(`/api/v1/projects/${projectId}/tasks`).send({ description: "No title" });
    expect(res.status).toBe(400);
  });

  it("rejects an invalid priority with 400", async () => {
    const res = await admin
      .post(`/api/v1/projects/${projectId}/tasks`)
      .send({ title: "Bad priority", priority: "SUPER" });
    expect(res.status).toBe(400);
  });

  it("returns 404 for an unknown assignee id", async () => {
    const res = await admin
      .post(`/api/v1/projects/${projectId}/tasks`)
      .send({ title: "Ghost assignee", assigneeId: "00000000-0000-0000-0000-000000000000" });
    expect(res.status).toBe(404);
  });

  it("returns 404 when a same-company non-member creates a task", async () => {
    const res = await outsiderAgent
      .post(`/api/v1/projects/${projectId}/tasks`)
      .send({ title: "No access" });
    expect(res.status).toBe(404);
  });
});

describe("Tasks — list", () => {
  let listTaskAssigned: string;
  let listTaskUnassigned: string;

  beforeAll(async () => {
    listTaskAssigned = await createTask(admin, "List assigned", { assigneeId: worker.id });
    listTaskUnassigned = await createTask(admin, "List unassigned");
  });

  it("returns all project tasks for ADMIN", async () => {
    const res = await admin.get(`/api/v1/projects/${projectId}/tasks`);
    expect(res.status).toBe(200);
    const ids = successBody<TaskData[]>(res).data.map((t) => t.id);
    expect(ids).toContain(listTaskAssigned);
    expect(ids).toContain(listTaskUnassigned);
  });

  it("returns only assigned tasks for WORKER", async () => {
    const res = await workerAgent.get(`/api/v1/projects/${projectId}/tasks`);
    expect(res.status).toBe(200);
    const ids = successBody<TaskData[]>(res).data.map((t) => t.id);
    expect(ids).toContain(listTaskAssigned);
    expect(ids).not.toContain(listTaskUnassigned);
  });

  it("supports status filtering", async () => {
    const res = await admin.get(`/api/v1/tasks?status=TODO`);
    expect(res.status).toBe(200);
    const tasks = successBody<TaskData[]>(res).data;
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks.every((t) => t.status === "TODO")).toBe(true);
  });
});

describe("Tasks — get by ID", () => {
  let taskId: string;

  beforeAll(async () => {
    taskId = await createTask(admin, "Get target", { assigneeId: worker.id });
  });

  it("returns the task for ADMIN", async () => {
    const res = await admin.get(`/api/v1/tasks/${taskId}`);
    expect(res.status).toBe(200);
    expect(successBody<TaskData>(res).data.title).toBe("Get target");
  });

  it("returns the task for its WORKER assignee", async () => {
    const res = await workerAgent.get(`/api/v1/tasks/${taskId}`);
    expect(res.status).toBe(200);
  });

  it("returns 404 for a WORKER who is not the assignee", async () => {
    const otherWorker = await createSecondUser(ctx, "WORKER");
    const otherAgent = await login(otherWorker);
    await admin.post(`/api/v1/projects/${projectId}/members`).send({ userId: otherWorker.id }).expect(201);

    const res = await otherAgent.get(`/api/v1/tasks/${taskId}`);
    expect(res.status).toBe(404);
  });

  it("returns 404 for a non-existent task", async () => {
    const res = await admin.get("/api/v1/tasks/00000000-0000-0000-0000-000000000000");
    expect(res.status).toBe(404);
  });
});

describe("Tasks — status transitions", () => {
  it("follows TODO → IN_PROGRESS → REVIEW → COMPLETED", async () => {
    const taskId = await createTask(admin, "Lifecycle", { assigneeId: worker.id });

    const toInProgress = await workerAgent
      .patch(`/api/v1/tasks/${taskId}/status`)
      .send({ status: "IN_PROGRESS" });
    expect(toInProgress.status).toBe(200);

    const toReview = await workerAgent
      .patch(`/api/v1/tasks/${taskId}/status`)
      .send({ status: "REVIEW" });
    expect(toReview.status).toBe(200);

    const toCompleted = await pmAgent
      .patch(`/api/v1/tasks/${taskId}/status`)
      .send({ status: "COMPLETED" });
    expect(toCompleted.status).toBe(200);

    const completed = successBody<TaskData>(toCompleted).data;
    expect(completed.status).toBe("COMPLETED");
    expect(completed.completionDate).not.toBeNull();
  });

  it("rejects an invalid transition TODO → REVIEW with 409", async () => {
    const taskId = await createTask(admin, "Invalid transition");
    const res = await admin.patch(`/api/v1/tasks/${taskId}/status`).send({ status: "REVIEW" });
    expect(res.status).toBe(409);
  });

  it("rejects an unknown status value with 400", async () => {
    const taskId = await createTask(admin, "Bad status value");
    const res = await admin.patch(`/api/v1/tasks/${taskId}/status`).send({ status: "DONE" });
    expect(res.status).toBe(400);
  });

  it("forbids a non-assignee WORKER from transitioning a task", async () => {
    const taskId = await createTask(admin, "Not yours");
    const res = await workerAgent.patch(`/api/v1/tasks/${taskId}/status`).send({ status: "IN_PROGRESS" });
    expect(res.status).toBe(403);
  });
});

describe("Tasks — update", () => {
  it("allows ADMIN to update all editable fields", async () => {
    const taskId = await createTask(admin, "Update me");
    const res = await admin
      .patch(`/api/v1/tasks/${taskId}`)
      .send({ title: "Updated", priority: "URGENT", description: "New description" });
    expect(res.status).toBe(200);

    const task = successBody<TaskData>(res).data;
    expect(task.title).toBe("Updated");
    expect(task.priority).toBe("URGENT");
  });

  it("forbids a WORKER assignee from editing restricted fields", async () => {
    const taskId = await createTask(admin, "Restricted", { assigneeId: worker.id });
    const res = await workerAgent.patch(`/api/v1/tasks/${taskId}`).send({ priority: "LOW" });
    expect(res.status).toBe(403);
  });

  it("allows a WORKER assignee to make a no-op field update", async () => {
    const taskId = await createTask(admin, "No-op", { assigneeId: worker.id });
    const res = await workerAgent.patch(`/api/v1/tasks/${taskId}`).send({});
    expect(res.status).toBe(200);
  });

  it("returns 404 for a same-company non-member", async () => {
    const taskId = await createTask(admin, "No access update");
    const res = await outsiderAgent.patch(`/api/v1/tasks/${taskId}`).send({ title: "Nope" });
    expect(res.status).toBe(404);
  });
});

describe("Tasks — delete", () => {
  it("deletes a task as ADMIN and removes it from the database", async () => {
    const taskId = await createTask(admin, "Delete me");
    const res = await admin.delete(`/api/v1/tasks/${taskId}`);
    expect(res.status).toBe(200);

    const stored = await prisma.task.findUnique({ where: { id: taskId } });
    expect(stored).toBeNull();
  });

  it("forbids WORKER from deleting a task", async () => {
    const taskId = await createTask(admin, "Worker cannot delete", { assigneeId: worker.id });
    const res = await workerAgent.delete(`/api/v1/tasks/${taskId}`);
    expect(res.status).toBe(403);
  });

  it("returns 404 for a same-company non-member delete attempt", async () => {
    const taskId = await createTask(admin, "No access delete");
    const res = await outsiderAgent.delete(`/api/v1/tasks/${taskId}`);
    expect(res.status).toBe(404);
  });
});
