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

let ctx: TestContext;
let admin: Agent;
let pm: TestUser;
let pmAgent: Agent;
let engineer: TestUser;
let engineerAgent: Agent;
let worker: TestUser;
let workerAgent: Agent;

let projectId: string;
let roleTarget: TestUser;
let memberTargetA: TestUser;
let memberTargetB: TestUser;

async function login(user: TestUser): Promise<Agent> {
  const agent = supertestAgent(app);
  await agent
    .post("/api/v1/auth/login")
    .send({ email: user.email, password: user.password })
    .expect(200);
  return agent;
}

async function createProject(agent: Agent, name: string, managerId?: string): Promise<string> {
  const res = await agent
    .post("/api/v1/projects")
    .send(managerId !== undefined ? { name, managerId } : { name });
  expect(res.status).toBe(201);
  return successBody<{ id: string }>(res).data.id;
}

async function createMaterial(agent: Agent, name: string): Promise<string> {
  const res = await agent.post("/api/v1/materials").send({ name, unit: "pcs" });
  expect(res.status).toBe(201);
  return successBody<{ id: string }>(res).data.id;
}

async function createExpense(agent: Agent, description: string): Promise<string> {
  const res = await agent.post("/api/v1/expenses").send({
    projectId,
    category: "OTHER",
    amount: 25,
    description,
    expenseDate: "2026-08-22",
  });
  expect(res.status).toBe(201);
  return successBody<{ id: string }>(res).data.id;
}

beforeAll(async () => {
  ctx = await setupTestContext("ADMIN");
  admin = ctx.agent;

  pm = await createSecondUser(ctx, "PROJECT_MANAGER");
  engineer = await createSecondUser(ctx, "ENGINEER");
  worker = await createSecondUser(ctx, "WORKER");
  roleTarget = await createSecondUser(ctx, "WORKER");
  memberTargetA = await createSecondUser(ctx, "WORKER");
  memberTargetB = await createSecondUser(ctx, "WORKER");

  pmAgent = await login(pm);
  engineerAgent = await login(engineer);
  workerAgent = await login(worker);

  // PM manages the shared project; engineer and worker are members.
  projectId = await createProject(admin, "RBAC project", pm.id);
  await admin.post(`/api/v1/projects/${projectId}/members`).send({ userId: engineer.id }).expect(201);
  await admin.post(`/api/v1/projects/${projectId}/members`).send({ userId: worker.id }).expect(201);
});

afterAll(async () => {
  await cleanupTestContext(ctx);
  await prisma.$disconnect();
});

describe("RBAC — projects", () => {
  it("allows ADMIN to create a project", async () => {
    const res = await admin.post("/api/v1/projects").send({ name: "By admin" });
    expect(res.status).toBe(201);
  });

  it("allows PROJECT_MANAGER to create a project", async () => {
    const res = await pmAgent.post("/api/v1/projects").send({ name: "By pm" });
    expect(res.status).toBe(201);
  });

  it("forbids ENGINEER from creating a project", async () => {
    const res = await engineerAgent.post("/api/v1/projects").send({ name: "By engineer" });
    expect(res.status).toBe(403);
  });

  it("forbids WORKER from creating a project", async () => {
    const res = await workerAgent.post("/api/v1/projects").send({ name: "By worker" });
    expect(res.status).toBe(403);
  });

  it("allows ADMIN and PROJECT_MANAGER to update a project", async () => {
    const byAdmin = await admin.patch(`/api/v1/projects/${projectId}`).send({ location: "Site 1" });
    expect(byAdmin.status).toBe(200);

    const byPm = await pmAgent.patch(`/api/v1/projects/${projectId}`).send({ location: "Site 2" });
    expect(byPm.status).toBe(200);
  });

  it("forbids ENGINEER and WORKER from updating a project", async () => {
    const byEngineer = await engineerAgent.patch(`/api/v1/projects/${projectId}`).send({ location: "Nope" });
    expect(byEngineer.status).toBe(403);

    const byWorker = await workerAgent.patch(`/api/v1/projects/${projectId}`).send({ location: "Nope" });
    expect(byWorker.status).toBe(403);
  });

  it("forbids non-ADMIN roles from deleting a project", async () => {
    const victim = await createProject(admin, "Delete victim");

    const byPm = await pmAgent.delete(`/api/v1/projects/${victim}`);
    expect(byPm.status).toBe(403);
    const byEngineer = await engineerAgent.delete(`/api/v1/projects/${victim}`);
    expect(byEngineer.status).toBe(403);
    const byWorker = await workerAgent.delete(`/api/v1/projects/${victim}`);
    expect(byWorker.status).toBe(403);

    const stillThere = await admin.get(`/api/v1/projects/${victim}`);
    expect(stillThere.status).toBe(200);
  });

  it("allows ADMIN to delete a project", async () => {
    const victim = await createProject(admin, "Admin delete ok");
    const res = await admin.delete(`/api/v1/projects/${victim}`);
    expect(res.status).toBe(200);
  });
});

describe("RBAC — project team", () => {
  it("allows ADMIN and PROJECT_MANAGER to add members", async () => {
    const byAdmin = await admin
      .post(`/api/v1/projects/${projectId}/members`)
      .send({ userId: memberTargetA.id });
    expect(byAdmin.status).toBe(201);

    const byPm = await pmAgent
      .post(`/api/v1/projects/${projectId}/members`)
      .send({ userId: memberTargetB.id });
    expect(byPm.status).toBe(201);
  });

  it("forbids ENGINEER and WORKER from adding members", async () => {
    const byEngineer = await engineerAgent
      .post(`/api/v1/projects/${projectId}/members`)
      .send({ userId: roleTarget.id });
    expect(byEngineer.status).toBe(403);

    const byWorker = await workerAgent
      .post(`/api/v1/projects/${projectId}/members`)
      .send({ userId: roleTarget.id });
    expect(byWorker.status).toBe(403);
  });

  it("allows PROJECT_MANAGER to remove members and forbids WORKER", async () => {
    const byWorker = await workerAgent
      .delete(`/api/v1/projects/${projectId}/members/${memberTargetB.id}`);
    expect(byWorker.status).toBe(403);

    const byPm = await pmAgent
      .delete(`/api/v1/projects/${projectId}/members/${memberTargetB.id}`);
    expect(byPm.status).toBe(200);
  });
});

describe("RBAC — tasks", () => {
  it("allows ADMIN, PROJECT_MANAGER and ENGINEER to create tasks", async () => {
    const byAdmin = await admin.post(`/api/v1/projects/${projectId}/tasks`).send({ title: "Admin task" });
    expect(byAdmin.status).toBe(201);

    const byPm = await pmAgent.post(`/api/v1/projects/${projectId}/tasks`).send({ title: "PM task" });
    expect(byPm.status).toBe(201);

    const byEngineer = await engineerAgent
      .post(`/api/v1/projects/${projectId}/tasks`)
      .send({ title: "Engineer task" });
    expect(byEngineer.status).toBe(201);
  });

  it("forbids WORKER from creating tasks", async () => {
    const res = await workerAgent.post(`/api/v1/projects/${projectId}/tasks`).send({ title: "Worker task" });
    expect(res.status).toBe(403);
  });

  it("allows a WORKER assignee to transition their own task status", async () => {
    const created = await admin
      .post(`/api/v1/projects/${projectId}/tasks`)
      .send({ title: "Worker assigned", assigneeId: worker.id });
    expect(created.status).toBe(201);
    const taskId = successBody<{ id: string }>(created).data.id;

    const res = await workerAgent.patch(`/api/v1/tasks/${taskId}/status`).send({ status: "IN_PROGRESS" });
    expect(res.status).toBe(200);
  });

  it("forbids a WORKER assignee from editing restricted task fields", async () => {
    const created = await admin
      .post(`/api/v1/projects/${projectId}/tasks`)
      .send({ title: "Worker restricted", assigneeId: worker.id });
    expect(created.status).toBe(201);
    const taskId = successBody<{ id: string }>(created).data.id;

    const res = await workerAgent.patch(`/api/v1/tasks/${taskId}`).send({ title: "Hijacked" });
    expect(res.status).toBe(403);
  });

  it("forbids a WORKER from updating a task they are not assigned to", async () => {
    const created = await admin
      .post(`/api/v1/projects/${projectId}/tasks`)
      .send({ title: "Not the worker's" });
    expect(created.status).toBe(201);
    const taskId = successBody<{ id: string }>(created).data.id;

    const res = await workerAgent.patch(`/api/v1/tasks/${taskId}/status`).send({ status: "IN_PROGRESS" });
    expect(res.status).toBe(403);
  });

  it("allows PROJECT_MANAGER to update task fields", async () => {
    const created = await admin
      .post(`/api/v1/projects/${projectId}/tasks`)
      .send({ title: "PM editable" });
    expect(created.status).toBe(201);
    const taskId = successBody<{ id: string }>(created).data.id;

    const res = await pmAgent.patch(`/api/v1/tasks/${taskId}`).send({ title: "PM updated" });
    expect(res.status).toBe(200);
    expect(successBody<{ title: string }>(res).data.title).toBe("PM updated");
  });

  it("forbids ENGINEER and WORKER from deleting tasks and allows ADMIN", async () => {
    const created = await admin
      .post(`/api/v1/projects/${projectId}/tasks`)
      .send({ title: "Delete me" });
    expect(created.status).toBe(201);
    const taskId = successBody<{ id: string }>(created).data.id;

    const byWorker = await workerAgent.delete(`/api/v1/tasks/${taskId}`);
    expect(byWorker.status).toBe(403);
    const byEngineer = await engineerAgent.delete(`/api/v1/tasks/${taskId}`);
    expect(byEngineer.status).toBe(403);

    const byAdmin = await admin.delete(`/api/v1/tasks/${taskId}`);
    expect(byAdmin.status).toBe(200);
  });
});

describe("RBAC — materials and inventory", () => {
  it("allows ADMIN, PROJECT_MANAGER and ENGINEER to create materials", async () => {
    expect((await admin.post("/api/v1/materials").send({ name: "Mat admin", unit: "pcs" })).status).toBe(201);
    expect((await pmAgent.post("/api/v1/materials").send({ name: "Mat pm", unit: "pcs" })).status).toBe(201);
    expect((await engineerAgent.post("/api/v1/materials").send({ name: "Mat engineer", unit: "pcs" })).status).toBe(201);
  });

  it("forbids WORKER from creating materials", async () => {
    const res = await workerAgent.post("/api/v1/materials").send({ name: "Mat worker", unit: "pcs" });
    expect(res.status).toBe(403);
  });

  it("allows ENGINEER to update a material and forbids WORKER", async () => {
    const materialId = await createMaterial(admin, "Update target");

    const byEngineer = await engineerAgent.patch(`/api/v1/materials/${materialId}`).send({ unit: "bags" });
    expect(byEngineer.status).toBe(200);

    const byWorker = await workerAgent.patch(`/api/v1/materials/${materialId}`).send({ unit: "tons" });
    expect(byWorker.status).toBe(403);
  });

  it("allows ENGINEER to record inventory transactions and forbids WORKER", async () => {
    const materialId = await createMaterial(admin, "Tx target");

    const byEngineer = await engineerAgent
      .post(`/api/v1/materials/${materialId}/transactions`)
      .send({ type: "PURCHASE", quantity: 5 });
    expect(byEngineer.status).toBe(201);

    const byWorker = await workerAgent
      .post(`/api/v1/materials/${materialId}/transactions`)
      .send({ type: "PURCHASE", quantity: 1 });
    expect(byWorker.status).toBe(403);
  });

  it("allows PROJECT_MANAGER to delete a material and forbids ENGINEER and WORKER", async () => {
    const materialId = await createMaterial(admin, "Delete target");

    const byWorker = await workerAgent.delete(`/api/v1/materials/${materialId}`);
    expect(byWorker.status).toBe(403);
    const byEngineer = await engineerAgent.delete(`/api/v1/materials/${materialId}`);
    expect(byEngineer.status).toBe(403);

    const byPm = await pmAgent.delete(`/api/v1/materials/${materialId}`);
    expect(byPm.status).toBe(200);
  });
});

describe("RBAC — expenses", () => {
  it("allows any role to submit an expense", async () => {
    const res = await workerAgent.post("/api/v1/expenses").send({
      projectId,
      category: "OTHER",
      amount: 10,
      description: "Worker expense",
      expenseDate: "2026-08-22",
    });
    expect(res.status).toBe(201);
  });

  it("allows PROJECT_MANAGER and ADMIN to review expenses", async () => {
    const forPm = await createExpense(workerAgent, "Reviewed by PM");
    const byPm = await pmAgent
      .patch(`/api/v1/expenses/${forPm}/review`)
      .send({ status: "APPROVED" });
    expect(byPm.status).toBe(200);

    const forAdmin = await createExpense(workerAgent, "Reviewed by admin");
    const byAdmin = await admin
      .patch(`/api/v1/expenses/${forAdmin}/review`)
      .send({ status: "REJECTED", rejectionReason: "Out of budget" });
    expect(byAdmin.status).toBe(200);
  });

  it("forbids ENGINEER and WORKER from reviewing expenses", async () => {
    const pending = await createExpense(workerAgent, "Not reviewable");

    const byEngineer = await engineerAgent
      .patch(`/api/v1/expenses/${pending}/review`)
      .send({ status: "APPROVED" });
    expect(byEngineer.status).toBe(403);

    const byWorker = await workerAgent
      .patch(`/api/v1/expenses/${pending}/review`)
      .send({ status: "APPROVED" });
    expect(byWorker.status).toBe(403);
  });

  it("forbids deleting another user's expense but allows the owner", async () => {
    const expenseId = await createExpense(workerAgent, "Owned by worker");

    const byPm = await pmAgent.delete(`/api/v1/expenses/${expenseId}`);
    expect(byPm.status).toBe(403);

    const byWorker = await workerAgent.delete(`/api/v1/expenses/${expenseId}`);
    expect(byWorker.status).toBe(200);
  });
});

describe("RBAC — company, users and invitations", () => {
  it("allows only ADMIN to update the company profile", async () => {
    const byAdmin = await admin.patch("/api/v1/company").send({ name: "Renamed by admin" });
    expect(byAdmin.status).toBe(200);

    const byPm = await pmAgent.patch("/api/v1/company").send({ name: "Nope" });
    expect(byPm.status).toBe(403);
    const byEngineer = await engineerAgent.patch("/api/v1/company").send({ name: "Nope" });
    expect(byEngineer.status).toBe(403);
    const byWorker = await workerAgent.patch("/api/v1/company").send({ name: "Nope" });
    expect(byWorker.status).toBe(403);
  });

  it("allows only ADMIN to list users", async () => {
    expect((await admin.get("/api/v1/users")).status).toBe(200);
    expect((await pmAgent.get("/api/v1/users")).status).toBe(403);
    expect((await workerAgent.get("/api/v1/users")).status).toBe(403);
  });

  it("allows only ADMIN to change user roles", async () => {
    const byPm = await pmAgent.patch(`/api/v1/users/${roleTarget.id}`).send({ role: "ENGINEER" });
    expect(byPm.status).toBe(403);

    const byAdmin = await admin.patch(`/api/v1/users/${roleTarget.id}`).send({ role: "ENGINEER" });
    expect(byAdmin.status).toBe(200);
  });

  it("forbids an ADMIN from changing their own role", async () => {
    const res = await admin.patch(`/api/v1/users/${ctx.user.id}`).send({ role: "WORKER" });
    expect(res.status).toBe(403);
  });

  it("allows only ADMIN to manage invitations", async () => {
    const inviteEmail = `rbac-invite-${String(Date.now())}@test.local`;

    const byWorker = await workerAgent
      .post("/api/v1/users/invitations")
      .send({ email: `w-${inviteEmail}`, name: "Worker Invite", role: "WORKER" });
    expect(byWorker.status).toBe(403);

    const byPm = await pmAgent
      .post("/api/v1/users/invitations")
      .send({ email: `p-${inviteEmail}`, name: "PM Invite", role: "WORKER" });
    expect(byPm.status).toBe(403);

    const byAdmin = await admin
      .post("/api/v1/users/invitations")
      .send({ email: inviteEmail, name: "Admin Invite", role: "WORKER" });
    expect(byAdmin.status).toBe(201);

    expect((await admin.get("/api/v1/users/invitations")).status).toBe(200);
    expect((await engineerAgent.get("/api/v1/users/invitations")).status).toBe(403);
  });
});
