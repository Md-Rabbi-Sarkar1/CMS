import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";

import type { TaskPriority, TaskStatus } from "@construction-ops/validation";

import { app } from "./app.js";
import { prisma } from "./providers/database.js";
import { createAccessToken } from "./utils/jwt.js";

interface TaskRow {
  id: string;
  projectId: string;
  assigneeId: string | null;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  startDate: string | null;
  dueDate: string | null;
  completionDate: string | null;
}

interface TaskEnvelope {
  success: boolean;
  data: TaskRow;
}

interface TaskListEnvelope {
  success: boolean;
  data: { tasks: TaskRow[] };
  meta: { page: number; pageSize: number; total: number };
}

interface ErrorEnvelope {
  success: boolean;
  error: { code: string; message: string; details?: { field: string; message: string }[] };
}

interface TestContext {
  companyAId: string;
  companyBId: string;
  adminAId: string;
  pmAId: string;
  pmOtherId: string;
  engineerAId: string;
  workerAId: string;
  inactiveUserId: string;
  strangerUserId: string;
  adminBId: string;
  projectA1Id: string;
  projectA2Id: string;
  projectA3Id: string;
  projectB1Id: string;
  taskManagedA1Id: string;
  taskMemberA2Id: string;
  taskOtherA3Id: string;
  taskB1Id: string;
  adminAToken: string;
  pmAToken: string;
  engineerAToken: string;
  workerAToken: string;
  adminBToken: string;
}

let ctx: TestContext;

beforeAll(async () => {
  const timestamp = Date.now().toString();
  const companyA = await prisma.company.create({
    data: { name: `Task Co A ${timestamp}`, slug: `task-co-a-${timestamp}` },
  });
  const companyB = await prisma.company.create({
    data: { name: `Task Co B ${timestamp}`, slug: `task-co-b-${timestamp}` },
  });

  const adminA = await prisma.user.create({
    data: { companyId: companyA.id, name: "Admin A", email: `k-admin-a-${timestamp}@test.local`, passwordHash: "x", role: "ADMIN" },
  });
  const pmA = await prisma.user.create({
    data: { companyId: companyA.id, name: "PM A", email: `k-pm-a-${timestamp}@test.local`, passwordHash: "x", role: "PROJECT_MANAGER" },
  });
  const pmOther = await prisma.user.create({
    data: { companyId: companyA.id, name: "PM Other", email: `k-pm-other-${timestamp}@test.local`, passwordHash: "x", role: "PROJECT_MANAGER" },
  });
  const engineerA = await prisma.user.create({
    data: { companyId: companyA.id, name: "Engineer A", email: `k-eng-a-${timestamp}@test.local`, passwordHash: "x", role: "ENGINEER" },
  });
  const workerA = await prisma.user.create({
    data: { companyId: companyA.id, name: "Worker A", email: `k-worker-a-${timestamp}@test.local`, passwordHash: "x", role: "WORKER" },
  });
  const inactiveUserA = await prisma.user.create({
    data: { companyId: companyA.id, name: "Inactive A", email: `k-inactive-a-${timestamp}@test.local`, passwordHash: "x", role: "WORKER", status: "INACTIVE" },
  });
  const strangerA = await prisma.user.create({
    data: { companyId: companyA.id, name: "Stranger A", email: `k-stranger-a-${timestamp}@test.local`, passwordHash: "x", role: "WORKER" },
  });
  const adminB = await prisma.user.create({
    data: { companyId: companyB.id, name: "Admin B", email: `k-admin-b-${timestamp}@test.local`, passwordHash: "x", role: "ADMIN" },
  });

  const projectA1 = await prisma.project.create({
    data: { companyId: companyA.id, name: "Alpha Site", managerId: pmA.id },
  });
  const projectA2 = await prisma.project.create({
    data: { companyId: companyA.id, name: "Beta Site", managerId: pmOther.id },
  });
  const projectA3 = await prisma.project.create({
    data: { companyId: companyA.id, name: "Gamma Site", managerId: pmOther.id },
  });
  const projectB1 = await prisma.project.create({
    data: { companyId: companyB.id, name: "Bravo Site" },
  });

  await prisma.projectMember.createMany({
    data: [
      { projectId: projectA1.id, userId: engineerA.id },
      { projectId: projectA2.id, userId: pmA.id },
      { projectId: projectA2.id, userId: workerA.id },
    ],
  });

  const taskManagedA1 = await prisma.task.create({
    data: {
      projectId: projectA1.id,
      title: "Managed task",
      description: "Managed description",
      assigneeId: engineerA.id,
      priority: "URGENT",
      status: "IN_PROGRESS",
    },
  });
  const taskMemberA2 = await prisma.task.create({
    data: {
      projectId: projectA2.id,
      title: "Member task",
      assigneeId: workerA.id,
    },
  });
  const taskOtherA3 = await prisma.task.create({
    data: {
      projectId: projectA3.id,
      title: "Other task",
    },
  });
  const taskB1 = await prisma.task.create({
    data: {
      projectId: projectB1.id,
      title: "B task",
    },
  });

  ctx = {
    companyAId: companyA.id,
    companyBId: companyB.id,
    adminAId: adminA.id,
    pmAId: pmA.id,
    pmOtherId: pmOther.id,
    engineerAId: engineerA.id,
    workerAId: workerA.id,
    inactiveUserId: inactiveUserA.id,
    strangerUserId: strangerA.id,
    adminBId: adminB.id,
    projectA1Id: projectA1.id,
    projectA2Id: projectA2.id,
    projectA3Id: projectA3.id,
    projectB1Id: projectB1.id,
    taskManagedA1Id: taskManagedA1.id,
    taskMemberA2Id: taskMemberA2.id,
    taskOtherA3Id: taskOtherA3.id,
    taskB1Id: taskB1.id,
    adminAToken: createAccessToken({ sub: adminA.id, companyId: companyA.id, role: "ADMIN" }),
    pmAToken: createAccessToken({ sub: pmA.id, companyId: companyA.id, role: "PROJECT_MANAGER" }),
    engineerAToken: createAccessToken({ sub: engineerA.id, companyId: companyA.id, role: "ENGINEER" }),
    workerAToken: createAccessToken({ sub: workerA.id, companyId: companyA.id, role: "WORKER" }),
    adminBToken: createAccessToken({ sub: adminB.id, companyId: companyB.id, role: "ADMIN" }),
  };
});

afterAll(async () => {
  await prisma.company.deleteMany({
    where: { id: { in: [ctx.companyAId, ctx.companyBId] } },
  });
});

describe("task management", () => {
  it("requires authentication", async () => {
    const listResponse = await request(app).get("/api/v1/tasks");
    expect(listResponse.status).toBe(401);

    const getResponse = await request(app).get(`/api/v1/tasks/${ctx.taskManagedA1Id}`);
    expect(getResponse.status).toBe(401);

    const createResponse = await request(app)
      .post("/api/v1/tasks")
      .send({ projectId: ctx.projectA1Id, title: "Unauthenticated" });
    expect(createResponse.status).toBe(401);

    const updateResponse = await request(app)
      .patch(`/api/v1/tasks/${ctx.taskManagedA1Id}`)
      .send({ title: "Unauthenticated" });
    expect(updateResponse.status).toBe(401);

    const statusResponse = await request(app)
      .patch(`/api/v1/tasks/${ctx.taskManagedA1Id}/status`)
      .send({ status: "IN_PROGRESS" });
    expect(statusResponse.status).toBe(401);

    const nestedListResponse = await request(app).get(`/api/v1/projects/${ctx.projectA1Id}/tasks`);
    expect(nestedListResponse.status).toBe(401);

    const nestedCreateResponse = await request(app)
      .post(`/api/v1/projects/${ctx.projectA1Id}/tasks`)
      .send({ title: "Unauthenticated" });
    expect(nestedCreateResponse.status).toBe(401);
  });

  it("allows an admin to list every task in the company", async () => {
    const response = await request(app)
      .get("/api/v1/tasks")
      .set("Cookie", `access_token=${ctx.adminAToken}`);

    expect(response.status).toBe(200);

    const body = response.body as TaskListEnvelope;
    const titles = body.data.tasks.map((task) => task.title);

    expect(titles).toContain("Managed task");
    expect(titles).toContain("Member task");
    expect(titles).toContain("Other task");
    expect(titles).not.toContain("B task");
    expect(body.meta.total).toBe(3);
  });

  it("shows a project manager tasks from managed and member projects only", async () => {
    const response = await request(app)
      .get("/api/v1/tasks")
      .set("Cookie", `access_token=${ctx.pmAToken}`);

    expect(response.status).toBe(200);

    const body = response.body as TaskListEnvelope;
    const titles = body.data.tasks.map((task) => task.title);

    expect(titles).toContain("Managed task");
    expect(titles).toContain("Member task");
    expect(titles).not.toContain("Other task");
    expect(body.meta.total).toBe(2);
  });

  it("shows a worker only tasks from projects they belong to", async () => {
    const response = await request(app)
      .get("/api/v1/tasks")
      .set("Cookie", `access_token=${ctx.workerAToken}`);

    expect(response.status).toBe(200);

    const body = response.body as TaskListEnvelope;
    const titles = body.data.tasks.map((task) => task.title);

    expect(titles).toContain("Member task");
    expect(titles).not.toContain("Managed task");
    expect(titles).not.toContain("Other task");
    expect(body.meta.total).toBe(1);
  });

  it("enforces cross-company isolation on task lists and lookups", async () => {
    const listResponse = await request(app)
      .get("/api/v1/tasks")
      .set("Cookie", `access_token=${ctx.adminBToken}`);

    expect(listResponse.status).toBe(200);

    const listBody = listResponse.body as TaskListEnvelope;
    const titles = listBody.data.tasks.map((task) => task.title);

    expect(titles).toContain("B task");
    expect(titles).not.toContain("Managed task");
    expect(titles).not.toContain("Member task");
    expect(titles).not.toContain("Other task");

    const getResponse = await request(app)
      .get(`/api/v1/tasks/${ctx.taskManagedA1Id}`)
      .set("Cookie", `access_token=${ctx.adminBToken}`);

    expect(getResponse.status).toBe(404);
  });

  it("filters tasks by status", async () => {
    const response = await request(app)
      .get("/api/v1/tasks?status=IN_PROGRESS")
      .set("Cookie", `access_token=${ctx.adminAToken}`);

    expect(response.status).toBe(200);

    const body = response.body as TaskListEnvelope;
    const titles = body.data.tasks.map((task) => task.title);

    expect(titles).toEqual(["Managed task"]);
    expect(body.meta.total).toBe(1);
  });

  it("filters tasks by assignee", async () => {
    const response = await request(app)
      .get(`/api/v1/tasks?assigneeId=${ctx.workerAId}`)
      .set("Cookie", `access_token=${ctx.adminAToken}`);

    expect(response.status).toBe(200);

    const body = response.body as TaskListEnvelope;
    const titles = body.data.tasks.map((task) => task.title);

    expect(titles).toEqual(["Member task"]);
    expect(body.meta.total).toBe(1);
  });

  it("sorts tasks by title", async () => {
    const response = await request(app)
      .get("/api/v1/tasks?sort=title:asc")
      .set("Cookie", `access_token=${ctx.adminAToken}`);

    expect(response.status).toBe(200);

    const body = response.body as TaskListEnvelope;
    const titles = body.data.tasks.map((task) => task.title);

    expect(titles).toEqual(["Managed task", "Member task", "Other task"]);
  });

  it("paginates the task list", async () => {
    const pageOne = await request(app)
      .get("/api/v1/tasks?page=1&pageSize=2")
      .set("Cookie", `access_token=${ctx.adminAToken}`);

    expect(pageOne.status).toBe(200);

    const bodyOne = pageOne.body as TaskListEnvelope;
    expect(bodyOne.data.tasks).toHaveLength(2);
    expect(bodyOne.meta.page).toBe(1);
    expect(bodyOne.meta.pageSize).toBe(2);
    expect(bodyOne.meta.total).toBe(3);

    const pageTwo = await request(app)
      .get("/api/v1/tasks?page=2&pageSize=2")
      .set("Cookie", `access_token=${ctx.adminAToken}`);

    expect(pageTwo.status).toBe(200);

    const bodyTwo = pageTwo.body as TaskListEnvelope;
    expect(bodyTwo.data.tasks).toHaveLength(1);
    expect(bodyTwo.meta.total).toBe(3);
  });

  it("lists tasks under a project and enforces project access", async () => {
    const adminResponse = await request(app)
      .get(`/api/v1/projects/${ctx.projectA1Id}/tasks`)
      .set("Cookie", `access_token=${ctx.adminAToken}`);

    expect(adminResponse.status).toBe(200);

    const adminBody = adminResponse.body as TaskListEnvelope;
    expect(adminBody.data.tasks.map((task) => task.title)).toContain("Managed task");

    const memberResponse = await request(app)
      .get(`/api/v1/projects/${ctx.projectA2Id}/tasks`)
      .set("Cookie", `access_token=${ctx.workerAToken}`);

    expect(memberResponse.status).toBe(200);

    const memberBody = memberResponse.body as TaskListEnvelope;
    expect(memberBody.data.tasks.map((task) => task.title)).toContain("Member task");

    const nonMemberResponse = await request(app)
      .get(`/api/v1/projects/${ctx.projectA1Id}/tasks`)
      .set("Cookie", `access_token=${ctx.workerAToken}`);

    expect(nonMemberResponse.status).toBe(403);

    const missingResponse = await request(app)
      .get(`/api/v1/projects/${crypto.randomUUID()}/tasks`)
      .set("Cookie", `access_token=${ctx.adminAToken}`);

    expect(missingResponse.status).toBe(404);

    const crossCompanyResponse = await request(app)
      .get(`/api/v1/projects/${ctx.projectA1Id}/tasks`)
      .set("Cookie", `access_token=${ctx.adminBToken}`);

    expect(crossCompanyResponse.status).toBe(404);
  });

  it("returns a full task record and enforces access on lookups", async () => {
    const response = await request(app)
      .get(`/api/v1/tasks/${ctx.taskManagedA1Id}`)
      .set("Cookie", `access_token=${ctx.adminAToken}`);

    expect(response.status).toBe(200);

    const body = response.body as TaskEnvelope;
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(ctx.taskManagedA1Id);
    expect(body.data.projectId).toBe(ctx.projectA1Id);
    expect(body.data.title).toBe("Managed task");
    expect(body.data.description).toBe("Managed description");
    expect(body.data.assigneeId).toBe(ctx.engineerAId);
    expect(body.data.priority).toBe("URGENT");
    expect(body.data.status).toBe("IN_PROGRESS");
    expect(body.data.startDate).toBeNull();
    expect(body.data.dueDate).toBeNull();
    expect(body.data.completionDate).toBeNull();

    const nonMemberResponse = await request(app)
      .get(`/api/v1/tasks/${ctx.taskManagedA1Id}`)
      .set("Cookie", `access_token=${ctx.workerAToken}`);

    expect(nonMemberResponse.status).toBe(403);

    const missingResponse = await request(app)
      .get(`/api/v1/tasks/${crypto.randomUUID()}`)
      .set("Cookie", `access_token=${ctx.adminAToken}`);

    expect(missingResponse.status).toBe(404);
  });

  it("creates a task with defaults through the flat endpoint", async () => {
    const response = await request(app)
      .post("/api/v1/tasks")
      .set("Cookie", `access_token=${ctx.adminAToken}`)
      .send({ projectId: ctx.projectA1Id, title: "Design foundation" });

    expect(response.status).toBe(201);

    const body = response.body as TaskEnvelope;
    expect(body.success).toBe(true);
    expect(body.data.projectId).toBe(ctx.projectA1Id);
    expect(body.data.title).toBe("Design foundation");
    expect(body.data.description).toBeNull();
    expect(body.data.assigneeId).toBeNull();
    expect(body.data.priority).toBe("MEDIUM");
    expect(body.data.status).toBe("TODO");
    expect(body.data.startDate).toBeNull();
    expect(body.data.dueDate).toBeNull();
    expect(body.data.completionDate).toBeNull();
  });

  it("creates a task with full input and echoes every field", async () => {
    const response = await request(app)
      .post("/api/v1/tasks")
      .set("Cookie", `access_token=${ctx.adminAToken}`)
      .send({
        projectId: ctx.projectA1Id,
        title: "Procure rebar",
        description: "Order grade 60 rebar",
        assigneeId: ctx.engineerAId,
        priority: "URGENT",
        startDate: "2026-01-10",
        dueDate: "2026-02-01",
      });

    expect(response.status).toBe(201);

    const body = response.body as TaskEnvelope;
    expect(body.data.title).toBe("Procure rebar");
    expect(body.data.description).toBe("Order grade 60 rebar");
    expect(body.data.assigneeId).toBe(ctx.engineerAId);
    expect(body.data.priority).toBe("URGENT");
    expect(body.data.startDate).not.toBeNull();
    expect(body.data.dueDate).not.toBeNull();
  });

  it("allows a managing project manager to create a task through the nested endpoint", async () => {
    const response = await request(app)
      .post(`/api/v1/projects/${ctx.projectA1Id}/tasks`)
      .set("Cookie", `access_token=${ctx.pmAToken}`)
      .send({ title: "Schedule inspection" });

    expect(response.status).toBe(201);

    const body = response.body as TaskEnvelope;
    expect(body.data.projectId).toBe(ctx.projectA1Id);
    expect(body.data.title).toBe("Schedule inspection");
  });

  it("rejects workers and engineers from creating tasks", async () => {
    const workerResponse = await request(app)
      .post("/api/v1/tasks")
      .set("Cookie", `access_token=${ctx.workerAToken}`)
      .send({ projectId: ctx.projectA1Id, title: "Worker task" });

    expect(workerResponse.status).toBe(403);

    const engineerResponse = await request(app)
      .post(`/api/v1/projects/${ctx.projectA1Id}/tasks`)
      .set("Cookie", `access_token=${ctx.engineerAToken}`)
      .send({ title: "Engineer task" });

    expect(engineerResponse.status).toBe(403);
  });

  it("rejects a project manager creating tasks in a project they do not manage", async () => {
    const response = await request(app)
      .post(`/api/v1/projects/${ctx.projectA3Id}/tasks`)
      .set("Cookie", `access_token=${ctx.pmAToken}`)
      .send({ title: "Unmanaged task" });

    expect(response.status).toBe(403);
  });

  it("requires a projectId on the flat create endpoint", async () => {
    const response = await request(app)
      .post("/api/v1/tasks")
      .set("Cookie", `access_token=${ctx.adminAToken}`)
      .send({ title: "No project" });

    expect(response.status).toBe(400);

    const body = response.body as ErrorEnvelope;
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details).toEqual([{ field: "projectId", message: "Invalid project ID" }]);
  });

  it("treats a project from another company as not found", async () => {
    const response = await request(app)
      .post("/api/v1/tasks")
      .set("Cookie", `access_token=${ctx.adminAToken}`)
      .send({ projectId: ctx.projectB1Id, title: "Wrong company" });

    expect(response.status).toBe(404);

    const body = response.body as ErrorEnvelope;
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("validates create input", async () => {
    const response = await request(app)
      .post("/api/v1/tasks")
      .set("Cookie", `access_token=${ctx.adminAToken}`)
      .send({ projectId: ctx.projectA1Id, title: "   " });

    expect(response.status).toBe(400);

    const body = response.body as ErrorEnvelope;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects assigning a user from another company", async () => {
    const response = await request(app)
      .post("/api/v1/tasks")
      .set("Cookie", `access_token=${ctx.adminAToken}`)
      .send({ projectId: ctx.projectA1Id, title: "Bad assignee", assigneeId: ctx.adminBId });

    expect(response.status).toBe(404);
  });

  it("rejects assigning an inactive user", async () => {
    const response = await request(app)
      .post("/api/v1/tasks")
      .set("Cookie", `access_token=${ctx.adminAToken}`)
      .send({ projectId: ctx.projectA1Id, title: "Inactive assignee", assigneeId: ctx.inactiveUserId });

    expect(response.status).toBe(409);
  });

  it("rejects assigning a user who is not a project member", async () => {
    const response = await request(app)
      .post("/api/v1/tasks")
      .set("Cookie", `access_token=${ctx.adminAToken}`)
      .send({ projectId: ctx.projectA1Id, title: "Non-member assignee", assigneeId: ctx.strangerUserId });

    expect(response.status).toBe(409);
  });

  it("allows an admin to update a task", async () => {
    const createResponse = await request(app)
      .post("/api/v1/tasks")
      .set("Cookie", `access_token=${ctx.adminAToken}`)
      .send({ projectId: ctx.projectA1Id, title: "Update me" });

    expect(createResponse.status).toBe(201);

    const created = createResponse.body as TaskEnvelope;

    const updateResponse = await request(app)
      .patch(`/api/v1/tasks/${created.data.id}`)
      .set("Cookie", `access_token=${ctx.adminAToken}`)
      .send({ title: "Updated title", description: "Updated description" });

    expect(updateResponse.status).toBe(200);

    const body = updateResponse.body as TaskEnvelope;
    expect(body.data.title).toBe("Updated title");
    expect(body.data.description).toBe("Updated description");
  });

  it("allows a managing project manager to update a task", async () => {
    const createResponse = await request(app)
      .post(`/api/v1/projects/${ctx.projectA1Id}/tasks`)
      .set("Cookie", `access_token=${ctx.pmAToken}`)
      .send({ title: "PM update me" });

    expect(createResponse.status).toBe(201);

    const created = createResponse.body as TaskEnvelope;

    const updateResponse = await request(app)
      .patch(`/api/v1/tasks/${created.data.id}`)
      .set("Cookie", `access_token=${ctx.pmAToken}`)
      .send({ priority: "HIGH" });

    expect(updateResponse.status).toBe(200);

    const body = updateResponse.body as TaskEnvelope;
    expect(body.data.priority).toBe("HIGH");
  });

  it("denies updates to members who do not manage the project", async () => {
    const createResponse = await request(app)
      .post("/api/v1/tasks")
      .set("Cookie", `access_token=${ctx.adminAToken}`)
      .send({ projectId: ctx.projectA1Id, title: "Hijack me" });

    expect(createResponse.status).toBe(201);

    const created = createResponse.body as TaskEnvelope;

    const updateResponse = await request(app)
      .patch(`/api/v1/tasks/${created.data.id}`)
      .set("Cookie", `access_token=${ctx.engineerAToken}`)
      .send({ title: "Hijacked" });

    expect(updateResponse.status).toBe(403);
  });

  it("rejects an empty task update body", async () => {
    const createResponse = await request(app)
      .post("/api/v1/tasks")
      .set("Cookie", `access_token=${ctx.adminAToken}`)
      .send({ projectId: ctx.projectA1Id, title: "Empty update me" });

    expect(createResponse.status).toBe(201);

    const created = createResponse.body as TaskEnvelope;

    const updateResponse = await request(app)
      .patch(`/api/v1/tasks/${created.data.id}`)
      .set("Cookie", `access_token=${ctx.adminAToken}`)
      .send({});

    expect(updateResponse.status).toBe(400);

    const body = updateResponse.body as ErrorEnvelope;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects reassigning a task to a non-member", async () => {
    const createResponse = await request(app)
      .post("/api/v1/tasks")
      .set("Cookie", `access_token=${ctx.adminAToken}`)
      .send({ projectId: ctx.projectA1Id, title: "Reassign non-member" });

    expect(createResponse.status).toBe(201);

    const created = createResponse.body as TaskEnvelope;

    const updateResponse = await request(app)
      .patch(`/api/v1/tasks/${created.data.id}`)
      .set("Cookie", `access_token=${ctx.adminAToken}`)
      .send({ assigneeId: ctx.strangerUserId });

    expect(updateResponse.status).toBe(409);
  });

  it("rejects reassigning a task to an inactive user", async () => {
    const createResponse = await request(app)
      .post("/api/v1/tasks")
      .set("Cookie", `access_token=${ctx.adminAToken}`)
      .send({ projectId: ctx.projectA1Id, title: "Reassign inactive" });

    expect(createResponse.status).toBe(201);

    const created = createResponse.body as TaskEnvelope;

    const updateResponse = await request(app)
      .patch(`/api/v1/tasks/${created.data.id}`)
      .set("Cookie", `access_token=${ctx.adminAToken}`)
      .send({ assigneeId: ctx.inactiveUserId });

    expect(updateResponse.status).toBe(409);
  });

  it("rejects reassigning a task to a nonexistent user", async () => {
    const createResponse = await request(app)
      .post("/api/v1/tasks")
      .set("Cookie", `access_token=${ctx.adminAToken}`)
      .send({ projectId: ctx.projectA1Id, title: "Reassign ghost" });

    expect(createResponse.status).toBe(201);

    const created = createResponse.body as TaskEnvelope;

    const updateResponse = await request(app)
      .patch(`/api/v1/tasks/${created.data.id}`)
      .set("Cookie", `access_token=${ctx.adminAToken}`)
      .send({ assigneeId: crypto.randomUUID() });

    expect(updateResponse.status).toBe(404);
  });

  it("returns not found when updating a missing task", async () => {
    const response = await request(app)
      .patch(`/api/v1/tasks/${crypto.randomUUID()}`)
      .set("Cookie", `access_token=${ctx.adminAToken}`)
      .send({ title: "Ghost" });

    expect(response.status).toBe(404);
  });

  it("applies status transition rules", async () => {
    const createResponse = await request(app)
      .post("/api/v1/tasks")
      .set("Cookie", `access_token=${ctx.adminAToken}`)
      .send({ projectId: ctx.projectA1Id, title: "Transition me" });

    expect(createResponse.status).toBe(201);

    const created = createResponse.body as TaskEnvelope;

    const invalidResponse = await request(app)
      .patch(`/api/v1/tasks/${created.data.id}/status`)
      .set("Cookie", `access_token=${ctx.adminAToken}`)
      .send({ status: "COMPLETED" });

    expect(invalidResponse.status).toBe(409);

    const sameResponse = await request(app)
      .patch(`/api/v1/tasks/${created.data.id}/status`)
      .set("Cookie", `access_token=${ctx.adminAToken}`)
      .send({ status: "TODO" });

    expect(sameResponse.status).toBe(409);

    const validResponse = await request(app)
      .patch(`/api/v1/tasks/${created.data.id}/status`)
      .set("Cookie", `access_token=${ctx.adminAToken}`)
      .send({ status: "IN_PROGRESS" });

    expect(validResponse.status).toBe(200);

    const body = validResponse.body as TaskEnvelope;
    expect(body.data.status).toBe("IN_PROGRESS");
  });

  it("rejects an invalid status value", async () => {
    const response = await request(app)
      .patch(`/api/v1/tasks/${ctx.taskManagedA1Id}/status`)
      .set("Cookie", `access_token=${ctx.adminAToken}`)
      .send({ status: "ARCHIVED" });

    expect(response.status).toBe(400);

    const body = response.body as ErrorEnvelope;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("allows an assignee to update their own task's status", async () => {
    const response = await request(app)
      .patch(`/api/v1/tasks/${ctx.taskMemberA2Id}/status`)
      .set("Cookie", `access_token=${ctx.workerAToken}`)
      .send({ status: "IN_PROGRESS" });

    expect(response.status).toBe(200);

    const body = response.body as TaskEnvelope;
    expect(body.data.status).toBe("IN_PROGRESS");
  });

  it("denies status updates to members who are not the assignee", async () => {
    const createResponse = await request(app)
      .post(`/api/v1/projects/${ctx.projectA2Id}/tasks`)
      .set("Cookie", `access_token=${ctx.adminAToken}`)
      .send({ title: "Not my task" });

    expect(createResponse.status).toBe(201);

    const created = createResponse.body as TaskEnvelope;

    const updateResponse = await request(app)
      .patch(`/api/v1/tasks/${created.data.id}/status`)
      .set("Cookie", `access_token=${ctx.workerAToken}`)
      .send({ status: "IN_PROGRESS" });

    expect(updateResponse.status).toBe(403);
  });

  it("records a completion date when a task reaches completed", async () => {
    const createResponse = await request(app)
      .post("/api/v1/tasks")
      .set("Cookie", `access_token=${ctx.adminAToken}`)
      .send({ projectId: ctx.projectA1Id, title: "Complete me" });

    expect(createResponse.status).toBe(201);

    const created = createResponse.body as TaskEnvelope;

    for (const status of ["IN_PROGRESS", "REVIEW", "COMPLETED"]) {
      const statusResponse = await request(app)
        .patch(`/api/v1/tasks/${created.data.id}/status`)
        .set("Cookie", `access_token=${ctx.adminAToken}`)
        .send({ status });

      expect(statusResponse.status).toBe(200);
    }

    const finalResponse = await request(app)
      .get(`/api/v1/tasks/${created.data.id}`)
      .set("Cookie", `access_token=${ctx.adminAToken}`);

    expect(finalResponse.status).toBe(200);

    const body = finalResponse.body as TaskEnvelope;
    expect(body.data.status).toBe("COMPLETED");
    expect(body.data.completionDate).not.toBeNull();
  });
});
