import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";

import type { ProjectStatus } from "@construction-ops/validation";

import { app } from "./app.js";
import { prisma } from "./providers/database.js";
import { createAccessToken } from "./utils/jwt.js";

interface ProjectEnvelope {
  success: boolean;
  data: {
    id: string;
    companyId: string;
    managerId: string | null;
    name: string;
    status: ProjectStatus;
    progressPercentage: number;
  };
}

interface ProjectListEnvelope {
  success: boolean;
  data: {
    projects: { id: string; name: string; status: ProjectStatus }[];
  };
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
  engineerAId: string;
  workerAId: string;
  adminBId: string;
  projectA1Id: string;
  projectA2Id: string;
  projectB1Id: string;
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
    data: { name: `Project Co A ${timestamp}`, slug: `project-co-a-${timestamp}` },
  });
  const companyB = await prisma.company.create({
    data: { name: `Project Co B ${timestamp}`, slug: `project-co-b-${timestamp}` },
  });

  const adminA = await prisma.user.create({
    data: { companyId: companyA.id, name: "Admin A", email: `p-admin-a-${timestamp}@test.local`, passwordHash: "x", role: "ADMIN" },
  });
  const pmA = await prisma.user.create({
    data: { companyId: companyA.id, name: "PM A", email: `p-pm-a-${timestamp}@test.local`, passwordHash: "x", role: "PROJECT_MANAGER" },
  });
  const engineerA = await prisma.user.create({
    data: { companyId: companyA.id, name: "Engineer A", email: `p-eng-a-${timestamp}@test.local`, passwordHash: "x", role: "ENGINEER" },
  });
  const workerA = await prisma.user.create({
    data: { companyId: companyA.id, name: "Worker A", email: `p-worker-a-${timestamp}@test.local`, passwordHash: "x", role: "WORKER" },
  });
  const adminB = await prisma.user.create({
    data: { companyId: companyB.id, name: "Admin B", email: `p-admin-b-${timestamp}@test.local`, passwordHash: "x", role: "ADMIN" },
  });

  const projectA1 = await prisma.project.create({
    data: { companyId: companyA.id, name: "Alpha Site", managerId: pmA.id },
  });
  const projectA2 = await prisma.project.create({
    data: { companyId: companyA.id, name: "Beta Site" },
  });
  const projectB1 = await prisma.project.create({
    data: { companyId: companyB.id, name: "Bravo Site" },
  });

  await prisma.projectMember.createMany({
    data: [
      { projectId: projectA2.id, userId: pmA.id },
      { projectId: projectA2.id, userId: workerA.id },
    ],
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
    projectB1Id: projectB1.id,
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

describe("project management", () => {
  it("requires authentication", async () => {
    const response = await request(app).get("/api/v1/projects");

    expect(response.status).toBe(401);
  });

  it("allows an admin to create a project with the creator as default manager", async () => {
    const response = await request(app)
      .post("/api/v1/projects")
      .set("Cookie", `access_token=${ctx.adminAToken}`)
      .send({ name: "Gamma Site", location: "Zone 3" });

    expect(response.status).toBe(201);

    const body = response.body as ProjectEnvelope;
    expect(body.success).toBe(true);
    expect(body.data.name).toBe("Gamma Site");
    expect(body.data.managerId).toBe(ctx.adminAId);
    expect(body.data.status).toBe("PLANNING");
    expect(body.data.progressPercentage).toBe(0);
  });

  it("rejects workers and engineers from creating projects", async () => {
    const workerResponse = await request(app)
      .post("/api/v1/projects")
      .set("Cookie", `access_token=${ctx.workerAToken}`)
      .send({ name: "Worker Project" });

    expect(workerResponse.status).toBe(403);

    const engineerResponse = await request(app)
      .post("/api/v1/projects")
      .set("Cookie", `access_token=${ctx.engineerAToken}`)
      .send({ name: "Engineer Project" });

    expect(engineerResponse.status).toBe(403);
  });

  it("validates create input", async () => {
    const response = await request(app)
      .post("/api/v1/projects")
      .set("Cookie", `access_token=${ctx.adminAToken}`)
      .send({ name: "   " });

    expect(response.status).toBe(400);

    const body = response.body as ErrorEnvelope;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("filters a worker's project list to projects they belong to", async () => {
    const response = await request(app)
      .get("/api/v1/projects")
      .set("Cookie", `access_token=${ctx.workerAToken}`);

    expect(response.status).toBe(200);

    const body = response.body as ProjectListEnvelope;
    const names = body.data.projects.map((project) => project.name);

    expect(names).toContain("Beta Site");
    expect(names).not.toContain("Alpha Site");
    expect(body.meta.total).toBe(1);
  });

  it("shows a project manager both managed and assigned projects", async () => {
    const response = await request(app)
      .get("/api/v1/projects")
      .set("Cookie", `access_token=${ctx.pmAToken}`);

    expect(response.status).toBe(200);

    const body = response.body as ProjectListEnvelope;
    const names = body.data.projects.map((project) => project.name);

    expect(names).toContain("Alpha Site");
    expect(names).toContain("Beta Site");
  });

  it("allows an admin to list all projects in the company", async () => {
    const response = await request(app)
      .get("/api/v1/projects")
      .set("Cookie", `access_token=${ctx.adminAToken}`);

    expect(response.status).toBe(200);

    const body = response.body as ProjectListEnvelope;
    const names = body.data.projects.map((project) => project.name);

    expect(names).toContain("Alpha Site");
    expect(names).toContain("Beta Site");
    expect(names).toContain("Gamma Site");
  });

  it("enforces cross-company isolation", async () => {
    const listResponse = await request(app)
      .get("/api/v1/projects")
      .set("Cookie", `access_token=${ctx.adminBToken}`);

    expect(listResponse.status).toBe(200);

    const listBody = listResponse.body as ProjectListEnvelope;
    const names = listBody.data.projects.map((project) => project.name);

    expect(names).not.toContain("Alpha Site");
    expect(names).toContain("Bravo Site");

    const getResponse = await request(app)
      .get(`/api/v1/projects/${ctx.projectA1Id}`)
      .set("Cookie", `access_token=${ctx.adminBToken}`);

    expect(getResponse.status).toBe(404);
  });

  it("lets members view a project and denies non-members", async () => {
    const memberResponse = await request(app)
      .get(`/api/v1/projects/${ctx.projectA2Id}`)
      .set("Cookie", `access_token=${ctx.workerAToken}`);

    expect(memberResponse.status).toBe(200);

    const nonMemberResponse = await request(app)
      .get(`/api/v1/projects/${ctx.projectA1Id}`)
      .set("Cookie", `access_token=${ctx.workerAToken}`);

    expect(nonMemberResponse.status).toBe(403);
  });

  it("allows the managing project manager to update a project", async () => {
    const response = await request(app)
      .patch(`/api/v1/projects/${ctx.projectA1Id}`)
      .set("Cookie", `access_token=${ctx.pmAToken}`)
      .send({ name: "Alpha Site Renamed" });

    expect(response.status).toBe(200);

    const body = response.body as ProjectEnvelope;
    expect(body.data.name).toBe("Alpha Site Renamed");
  });

  it("denies updates to members who do not manage the project", async () => {
    const response = await request(app)
      .patch(`/api/v1/projects/${ctx.projectA1Id}`)
      .set("Cookie", `access_token=${ctx.engineerAToken}`)
      .send({ name: "Hijacked" });

    expect(response.status).toBe(403);
  });

  it("rejects an empty project update body", async () => {
    const response = await request(app)
      .patch(`/api/v1/projects/${ctx.projectA2Id}`)
      .set("Cookie", `access_token=${ctx.adminAToken}`)
      .send({});

    expect(response.status).toBe(400);
  });

  it("applies status transition rules for managing project managers", async () => {
    const createResponse = await request(app)
      .post("/api/v1/projects")
      .set("Cookie", `access_token=${ctx.pmAToken}`)
      .send({ name: "Status Site" });

    expect(createResponse.status).toBe(201);

    const created = createResponse.body as ProjectEnvelope;

    const invalidResponse = await request(app)
      .patch(`/api/v1/projects/${created.data.id}/status`)
      .set("Cookie", `access_token=${ctx.pmAToken}`)
      .send({ status: "COMPLETED" });

    expect(invalidResponse.status).toBe(409);

    const validResponse = await request(app)
      .patch(`/api/v1/projects/${created.data.id}/status`)
      .set("Cookie", `access_token=${ctx.pmAToken}`)
      .send({ status: "ACTIVE" });

    expect(validResponse.status).toBe(200);

    const body = validResponse.body as ProjectEnvelope;
    expect(body.data.status).toBe("ACTIVE");
  });

  it("denies status changes to members who do not manage the project", async () => {
    const response = await request(app)
      .patch(`/api/v1/projects/${ctx.projectA2Id}/status`)
      .set("Cookie", `access_token=${ctx.workerAToken}`)
      .send({ status: "ACTIVE" });

    expect(response.status).toBe(403);
  });

  it("allows progress updates and rejects out-of-range values", async () => {
    const createResponse = await request(app)
      .post("/api/v1/projects")
      .set("Cookie", `access_token=${ctx.pmAToken}`)
      .send({ name: "Progress Site" });

    expect(createResponse.status).toBe(201);

    const created = createResponse.body as ProjectEnvelope;

    const invalidResponse = await request(app)
      .patch(`/api/v1/projects/${created.data.id}/progress`)
      .set("Cookie", `access_token=${ctx.pmAToken}`)
      .send({ progressPercentage: 150 });

    expect(invalidResponse.status).toBe(400);

    const validResponse = await request(app)
      .patch(`/api/v1/projects/${created.data.id}/progress`)
      .set("Cookie", `access_token=${ctx.pmAToken}`)
      .send({ progressPercentage: 42 });

    expect(validResponse.status).toBe(200);

    const body = validResponse.body as ProjectEnvelope;
    expect(body.data.progressPercentage).toBe(42);
  });

  it("rejects assigning a manager from another company", async () => {
    const response = await request(app)
      .post("/api/v1/projects")
      .set("Cookie", `access_token=${ctx.adminAToken}`)
      .send({ name: "Manager Site", managerId: ctx.adminBId });

    expect(response.status).toBe(404);
  });

  it("allows reassigning a manager to a user in the same company", async () => {
    const createResponse = await request(app)
      .post("/api/v1/projects")
      .set("Cookie", `access_token=${ctx.adminAToken}`)
      .send({ name: "Manager Site 2" });

    expect(createResponse.status).toBe(201);

    const created = createResponse.body as ProjectEnvelope;

    const updateResponse = await request(app)
      .patch(`/api/v1/projects/${created.data.id}`)
      .set("Cookie", `access_token=${ctx.adminAToken}`)
      .send({ managerId: ctx.engineerAId });

    expect(updateResponse.status).toBe(200);

    const body = updateResponse.body as ProjectEnvelope;
    expect(body.data.managerId).toBe(ctx.engineerAId);
  });
});
