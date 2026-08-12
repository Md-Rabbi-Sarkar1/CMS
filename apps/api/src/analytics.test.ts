import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";

import { app } from "./app.js";
import { prisma } from "./providers/database.js";
import { createAccessToken } from "./utils/jwt.js";

interface CompanyDashboardEnvelope {
  success: boolean;
  data: {
    totalProjects: number;
    activeProjects: number;
    completedProjects: number;
    totalTeamMembers: number;
    totalTasks: number;
    completedTasks: number;
    openTasks: number;
  };
}

interface ProjectDashboardEnvelope {
  success: boolean;
  data: {
    progressPercentage: number;
    budget: string | null;
    totalTasks: number;
    completedTasks: number;
    openTasks: number;
    openIssues: number;
    recentActivity: string[];
  };
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
  engineerAId: string;
  workerAId: string;
  adminBId: string;
  projectA1Id: string;
  projectA2Id: string;
  projectA3Id: string;
  projectB1Id: string;
  taskA1Id: string;
  taskA2Id: string;
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
    data: { name: `Analytics Co A ${timestamp}`, slug: `analytics-co-a-${timestamp}` },
  });
  const companyB = await prisma.company.create({
    data: { name: `Analytics Co B ${timestamp}`, slug: `analytics-co-b-${timestamp}` },
  });

  const adminA = await prisma.user.create({
    data: { companyId: companyA.id, name: "Admin A", email: `analytics-admin-a-${timestamp}@test.local`, passwordHash: "x", role: "ADMIN" },
  });
  const pmA = await prisma.user.create({
    data: { companyId: companyA.id, name: "PM A", email: `analytics-pm-a-${timestamp}@test.local`, passwordHash: "x", role: "PROJECT_MANAGER" },
  });
  const engineerA = await prisma.user.create({
    data: { companyId: companyA.id, name: "Engineer A", email: `analytics-eng-a-${timestamp}@test.local`, passwordHash: "x", role: "ENGINEER" },
  });
  const workerA = await prisma.user.create({
    data: { companyId: companyA.id, name: "Worker A", email: `analytics-worker-a-${timestamp}@test.local`, passwordHash: "x", role: "WORKER" },
  });
  const adminB = await prisma.user.create({
    data: { companyId: companyB.id, name: "Admin B", email: `analytics-admin-b-${timestamp}@test.local`, passwordHash: "x", role: "ADMIN" },
  });

  const projectA1 = await prisma.project.create({
    data: { companyId: companyA.id, name: "Alpha Site", managerId: pmA.id, status: "ACTIVE", progressPercentage: 45, budget: "100000" },
  });
  const projectA2 = await prisma.project.create({
    data: { companyId: companyA.id, name: "Beta Site", managerId: pmA.id, status: "COMPLETED", progressPercentage: 100, budget: "50000" },
  });
  const projectA3 = await prisma.project.create({
    data: { companyId: companyA.id, name: "Gamma Site", managerId: pmA.id, status: "ACTIVE", progressPercentage: 20, budget: "80000" },
  });
  const projectB1 = await prisma.project.create({
    data: { companyId: companyB.id, name: "Bravo Site", status: "ACTIVE", progressPercentage: 30, budget: "75000" },
  });

  await prisma.projectMember.createMany({
    data: [
      { projectId: projectA1.id, userId: engineerA.id },
      { projectId: projectA1.id, userId: workerA.id },
      { projectId: projectA2.id, userId: engineerA.id },
      { projectId: projectA2.id, userId: workerA.id },
    ],
  });

  const taskA1 = await prisma.task.create({
    data: { projectId: projectA1.id, title: "Task A1", status: "TODO" },
  });
  const taskA2 = await prisma.task.create({
    data: { projectId: projectA1.id, title: "Task A2", status: "COMPLETED" },
  });
  const taskB1 = await prisma.task.create({
    data: { projectId: projectB1.id, title: "Task B1", status: "IN_PROGRESS" },
  });

  ctx = {
    companyAId: companyA.id,
    companyBId: companyB.id,
    adminAId: adminA.id,
    pmAId: pmA.id,
    engineerAId: engineerA.id,
    workerAId: workerA.id,
    adminBId: adminB.id,
    projectA1Id: projectA1.id,
    projectA2Id: projectA2.id,
    projectA3Id: projectA3.id,
    projectB1Id: projectB1.id,
    taskA1Id: taskA1.id,
    taskA2Id: taskA2.id,
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

describe("analytics", () => {
  it("requires authentication", async () => {
    const companyResponse = await request(app).get("/api/v1/analytics/company");
    expect(companyResponse.status).toBe(401);

    const projectResponse = await request(app).get(`/api/v1/analytics/projects/${ctx.projectA1Id}`);
    expect(projectResponse.status).toBe(401);
  });

  it("allows ADMIN to view company dashboard", async () => {
    const response = await request(app)
      .get("/api/v1/analytics/company")
      .set("Cookie", `access_token=${ctx.adminAToken}`);

    expect(response.status).toBe(200);

    const body = response.body as CompanyDashboardEnvelope;
    expect(body.success).toBe(true);
    expect(body.data.totalProjects).toBe(3);
    expect(body.data.activeProjects).toBe(2);
    expect(body.data.completedProjects).toBe(1);
    expect(body.data.totalTeamMembers).toBe(4);
    expect(body.data.totalTasks).toBe(2);
    expect(body.data.completedTasks).toBe(1);
    expect(body.data.openTasks).toBe(1);
  });

  it("forbids non-ADMIN from viewing company dashboard", async () => {
    const pmResponse = await request(app)
      .get("/api/v1/analytics/company")
      .set("Cookie", `access_token=${ctx.pmAToken}`);

    expect(pmResponse.status).toBe(403);

    const engineerResponse = await request(app)
      .get("/api/v1/analytics/company")
      .set("Cookie", `access_token=${ctx.engineerAToken}`);

    expect(engineerResponse.status).toBe(403);

    const workerResponse = await request(app)
      .get("/api/v1/analytics/company")
      .set("Cookie", `access_token=${ctx.workerAToken}`);

    expect(workerResponse.status).toBe(403);
  });

  it("enforces cross-company isolation on company dashboard", async () => {
    const response = await request(app)
      .get("/api/v1/analytics/company")
      .set("Cookie", `access_token=${ctx.adminBToken}`);

    expect(response.status).toBe(200);

    const body = response.body as CompanyDashboardEnvelope;
    expect(body.data.totalProjects).toBe(1);
    expect(body.data.totalTeamMembers).toBe(1);
    expect(body.data.totalTasks).toBe(1);
  });

  it("allows project member to view project dashboard", async () => {
    const response = await request(app)
      .get(`/api/v1/analytics/projects/${ctx.projectA1Id}`)
      .set("Cookie", `access_token=${ctx.engineerAToken}`);

    expect(response.status).toBe(200);

    const body = response.body as ProjectDashboardEnvelope;
    expect(body.success).toBe(true);
    expect(body.data.progressPercentage).toBe(45);
    expect(body.data.budget).toBe("100000");
    expect(body.data.totalTasks).toBe(2);
    expect(body.data.completedTasks).toBe(1);
    expect(body.data.openTasks).toBe(1);
    expect(body.data.openIssues).toBe(0);
    expect(body.data.recentActivity).toEqual([]);
  });

  it("allows project manager to view managed project dashboard", async () => {
    const response = await request(app)
      .get(`/api/v1/analytics/projects/${ctx.projectA1Id}`)
      .set("Cookie", `access_token=${ctx.pmAToken}`);

    expect(response.status).toBe(200);

    const body = response.body as ProjectDashboardEnvelope;
    expect(body.success).toBe(true);
    expect(body.data.totalTasks).toBe(2);
  });

  it("allows ADMIN to view any project dashboard", async () => {
    const response = await request(app)
      .get(`/api/v1/analytics/projects/${ctx.projectA1Id}`)
      .set("Cookie", `access_token=${ctx.adminAToken}`);

    expect(response.status).toBe(200);

    const body = response.body as ProjectDashboardEnvelope;
    expect(body.success).toBe(true);
  });

  it("verifies correct project task counts", async () => {
    const response = await request(app)
      .get(`/api/v1/analytics/projects/${ctx.projectA1Id}`)
      .set("Cookie", `access_token=${ctx.adminAToken}`);

    expect(response.status).toBe(200);

    const body = response.body as ProjectDashboardEnvelope;
    expect(body.data.totalTasks).toBe(2);
    expect(body.data.completedTasks).toBe(1);
    expect(body.data.openTasks).toBe(1);
  });

  it("verifies correct company task counts", async () => {
    const response = await request(app)
      .get("/api/v1/analytics/company")
      .set("Cookie", `access_token=${ctx.adminAToken}`);

    expect(response.status).toBe(200);

    const body = response.body as CompanyDashboardEnvelope;
    expect(body.data.totalTasks).toBe(2);
    expect(body.data.completedTasks).toBe(1);
    expect(body.data.openTasks).toBe(1);
  });

  it("verifies correct project progress and budget", async () => {
    const response = await request(app)
      .get(`/api/v1/analytics/projects/${ctx.projectA1Id}`)
      .set("Cookie", `access_token=${ctx.adminAToken}`);

    expect(response.status).toBe(200);

    const body = response.body as ProjectDashboardEnvelope;
    expect(body.data.progressPercentage).toBe(45);
    expect(body.data.budget).toBe("100000");
  });

  it("forbids non-member from viewing project dashboard", async () => {
    const response = await request(app)
      .get(`/api/v1/analytics/projects/${ctx.projectA3Id}`)
      .set("Cookie", `access_token=${ctx.workerAToken}`);

    expect(response.status).toBe(403);
  });

  it("returns 404 for cross-company project dashboard", async () => {
    const response = await request(app)
      .get(`/api/v1/analytics/projects/${ctx.projectA1Id}`)
      .set("Cookie", `access_token=${ctx.adminBToken}`);

    expect(response.status).toBe(404);
  });

  it("returns 404 for missing project dashboard", async () => {
    const response = await request(app)
      .get(`/api/v1/analytics/projects/${crypto.randomUUID()}`)
      .set("Cookie", `access_token=${ctx.adminAToken}`);

    expect(response.status).toBe(404);
  });

  it("validates project ID format", async () => {
    const response = await request(app)
      .get("/api/v1/analytics/projects/invalid-uuid")
      .set("Cookie", `access_token=${ctx.adminAToken}`);

    expect(response.status).toBe(400);

    const body = response.body as ErrorEnvelope;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("handles empty project dashboard", async () => {
    const emptyProject = await prisma.project.create({
      data: { companyId: ctx.companyAId, name: "Empty Project", managerId: ctx.pmAId, status: "PLANNING", progressPercentage: 0 },
    });

    await prisma.projectMember.create({
      data: { projectId: emptyProject.id, userId: ctx.engineerAId },
    });

    const response = await request(app)
      .get(`/api/v1/analytics/projects/${emptyProject.id}`)
      .set("Cookie", `access_token=${ctx.engineerAToken}`);

    expect(response.status).toBe(200);

    const body = response.body as ProjectDashboardEnvelope;
    expect(body.data.totalTasks).toBe(0);
    expect(body.data.completedTasks).toBe(0);
    expect(body.data.openTasks).toBe(0);

    await prisma.project.delete({ where: { id: emptyProject.id } });
  });

  it("handles empty company dashboard", async () => {
    const emptyCompany = await prisma.company.create({
      data: { name: "Empty Company", slug: "empty-company" },
    });

    const emptyAdmin = await prisma.user.create({
      data: { companyId: emptyCompany.id, name: "Empty Admin", email: "empty-admin@test.local", passwordHash: "x", role: "ADMIN" },
    });

    const emptyAdminToken = createAccessToken({ sub: emptyAdmin.id, companyId: emptyCompany.id, role: "ADMIN" });

    const response = await request(app)
      .get("/api/v1/analytics/company")
      .set("Cookie", `access_token=${emptyAdminToken}`);

    expect(response.status).toBe(200);

    const body = response.body as CompanyDashboardEnvelope;
    expect(body.data.totalProjects).toBe(0);
    expect(body.data.totalTeamMembers).toBe(1);
    expect(body.data.totalTasks).toBe(0);

    await prisma.company.delete({ where: { id: emptyCompany.id } });
  });
});
