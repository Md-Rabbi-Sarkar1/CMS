import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";

import { app } from "./app.js";
import { prisma } from "./providers/database.js";
import { createAccessToken } from "./utils/jwt.js";

interface Member {
  userId: string;
  name: string;
  email: string;
  role: string;
  status: string;
  assignedAt: string;
}

interface MemberEnvelope {
  success: boolean;
  data: Member;
}

interface MemberListEnvelope {
  success: boolean;
  data: { members: Member[] };
  meta: { page: number; pageSize: number; total: number };
}

interface TestContext {
  companyAId: string;
  companyBId: string;
  adminAId: string;
  pmAId: string;
  engineerAId: string;
  workerAId: string;
  targetUserId: string;
  inactiveUserId: string;
  strangerUserId: string;
  member1Id: string;
  member2Id: string;
  adminBId: string;
  projectA1Id: string;
  projectA2Id: string;
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
    data: { name: `Team Co A ${timestamp}`, slug: `team-co-a-${timestamp}` },
  });
  const companyB = await prisma.company.create({
    data: { name: `Team Co B ${timestamp}`, slug: `team-co-b-${timestamp}` },
  });

  const adminA = await prisma.user.create({
    data: { companyId: companyA.id, name: "Admin A", email: `t-admin-a-${timestamp}@test.local`, passwordHash: "x", role: "ADMIN" },
  });
  const pmA = await prisma.user.create({
    data: { companyId: companyA.id, name: "PM A", email: `t-pm-a-${timestamp}@test.local`, passwordHash: "x", role: "PROJECT_MANAGER" },
  });
  const pmOther = await prisma.user.create({
    data: { companyId: companyA.id, name: "PM Other", email: `t-pm-other-${timestamp}@test.local`, passwordHash: "x", role: "PROJECT_MANAGER" },
  });
  const engineerA = await prisma.user.create({
    data: { companyId: companyA.id, name: "Engineer A", email: `t-eng-a-${timestamp}@test.local`, passwordHash: "x", role: "ENGINEER" },
  });
  const workerA = await prisma.user.create({
    data: { companyId: companyA.id, name: "Worker A", email: `t-worker-a-${timestamp}@test.local`, passwordHash: "x", role: "WORKER" },
  });
  const targetUserA = await prisma.user.create({
    data: { companyId: companyA.id, name: "Target A", email: `t-target-a-${timestamp}@test.local`, passwordHash: "x", role: "ENGINEER" },
  });
  const inactiveUserA = await prisma.user.create({
    data: { companyId: companyA.id, name: "Inactive A", email: `t-inactive-a-${timestamp}@test.local`, passwordHash: "x", role: "WORKER", status: "INACTIVE" },
  });
  const strangerA = await prisma.user.create({
    data: { companyId: companyA.id, name: "Stranger A", email: `t-stranger-a-${timestamp}@test.local`, passwordHash: "x", role: "WORKER" },
  });
  const member1A = await prisma.user.create({
    data: { companyId: companyA.id, name: "Member 1 A", email: `t-member1-a-${timestamp}@test.local`, passwordHash: "x", role: "ENGINEER" },
  });
  const member2A = await prisma.user.create({
    data: { companyId: companyA.id, name: "Member 2 A", email: `t-member2-a-${timestamp}@test.local`, passwordHash: "x", role: "ENGINEER" },
  });
  const adminB = await prisma.user.create({
    data: { companyId: companyB.id, name: "Admin B", email: `t-admin-b-${timestamp}@test.local`, passwordHash: "x", role: "ADMIN" },
  });

  const projectA1 = await prisma.project.create({
    data: { companyId: companyA.id, name: "Alpha Site", managerId: pmA.id },
  });
  const projectA2 = await prisma.project.create({
    data: { companyId: companyA.id, name: "Beta Site", managerId: pmOther.id },
  });

  await prisma.projectMember.create({
    data: { projectId: projectA1.id, userId: engineerA.id },
  });

  ctx = {
    companyAId: companyA.id,
    companyBId: companyB.id,
    adminAId: adminA.id,
    pmAId: pmA.id,
    engineerAId: engineerA.id,
    workerAId: workerA.id,
    targetUserId: targetUserA.id,
    inactiveUserId: inactiveUserA.id,
    strangerUserId: strangerA.id,
    member1Id: member1A.id,
    member2Id: member2A.id,
    adminBId: adminB.id,
    projectA1Id: projectA1.id,
    projectA2Id: projectA2.id,
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

describe("team management", () => {
  it("requires authentication", async () => {
    const getResponse = await request(app).get(`/api/v1/projects/${ctx.projectA1Id}/members`);

    expect(getResponse.status).toBe(401);

    const postResponse = await request(app)
      .post(`/api/v1/projects/${ctx.projectA1Id}/members`)
      .send({ userId: ctx.workerAId });

    expect(postResponse.status).toBe(401);

    const deleteResponse = await request(app).delete(`/api/v1/projects/${ctx.projectA1Id}/members/${ctx.workerAId}`);

    expect(deleteResponse.status).toBe(401);
  });

  it("allows an admin to list project members", async () => {
    const response = await request(app)
      .get(`/api/v1/projects/${ctx.projectA1Id}/members`)
      .set("Cookie", `access_token=${ctx.adminAToken}`);

    expect(response.status).toBe(200);

    const body = response.body as MemberListEnvelope;
    const ids = body.data.members.map((member) => member.userId);

    expect(ids).toContain(ctx.engineerAId);
    expect(body.meta.total).toBe(1);
  });

  it("allows an admin to add a member", async () => {
    const response = await request(app)
      .post(`/api/v1/projects/${ctx.projectA1Id}/members`)
      .set("Cookie", `access_token=${ctx.adminAToken}`)
      .send({ userId: ctx.targetUserId });

    expect(response.status).toBe(201);

    const body = response.body as MemberEnvelope;
    expect(body.success).toBe(true);
    expect(body.data.userId).toBe(ctx.targetUserId);
  });

  it("allows an admin to remove a member", async () => {
    const response = await request(app)
      .delete(`/api/v1/projects/${ctx.projectA1Id}/members/${ctx.targetUserId}`)
      .set("Cookie", `access_token=${ctx.adminAToken}`);

    expect(response.status).toBe(204);
  });

  it("allows a project manager to manage members on their own project", async () => {
    const addResponse = await request(app)
      .post(`/api/v1/projects/${ctx.projectA1Id}/members`)
      .set("Cookie", `access_token=${ctx.pmAToken}`)
      .send({ userId: ctx.workerAId });

    expect(addResponse.status).toBe(201);

    const removeResponse = await request(app)
      .delete(`/api/v1/projects/${ctx.projectA1Id}/members/${ctx.workerAId}`)
      .set("Cookie", `access_token=${ctx.pmAToken}`);

    expect(removeResponse.status).toBe(204);
  });

  it("denies a project manager managing another manager's project", async () => {
    const addResponse = await request(app)
      .post(`/api/v1/projects/${ctx.projectA2Id}/members`)
      .set("Cookie", `access_token=${ctx.pmAToken}`)
      .send({ userId: ctx.workerAId });

    expect(addResponse.status).toBe(403);

    const removeResponse = await request(app)
      .delete(`/api/v1/projects/${ctx.projectA2Id}/members/${ctx.engineerAId}`)
      .set("Cookie", `access_token=${ctx.pmAToken}`);

    expect(removeResponse.status).toBe(403);
  });

  it("denies engineers from adding or removing members", async () => {
    const addResponse = await request(app)
      .post(`/api/v1/projects/${ctx.projectA1Id}/members`)
      .set("Cookie", `access_token=${ctx.engineerAToken}`)
      .send({ userId: ctx.workerAId });

    expect(addResponse.status).toBe(403);

    const removeResponse = await request(app)
      .delete(`/api/v1/projects/${ctx.projectA1Id}/members/${ctx.engineerAId}`)
      .set("Cookie", `access_token=${ctx.engineerAToken}`);

    expect(removeResponse.status).toBe(403);
  });

  it("denies workers from adding or removing members", async () => {
    const addResponse = await request(app)
      .post(`/api/v1/projects/${ctx.projectA1Id}/members`)
      .set("Cookie", `access_token=${ctx.workerAToken}`)
      .send({ userId: ctx.workerAId });

    expect(addResponse.status).toBe(403);

    const removeResponse = await request(app)
      .delete(`/api/v1/projects/${ctx.projectA1Id}/members/${ctx.engineerAId}`)
      .set("Cookie", `access_token=${ctx.workerAToken}`);

    expect(removeResponse.status).toBe(403);
  });

  it("treats a project from another company as not found", async () => {
    const getResponse = await request(app)
      .get(`/api/v1/projects/${ctx.projectA1Id}/members`)
      .set("Cookie", `access_token=${ctx.adminBToken}`);

    expect(getResponse.status).toBe(404);

    const addResponse = await request(app)
      .post(`/api/v1/projects/${ctx.projectA1Id}/members`)
      .set("Cookie", `access_token=${ctx.adminBToken}`)
      .send({ userId: ctx.adminBId });

    expect(addResponse.status).toBe(404);
  });

  it("rejects adding a user from another company", async () => {
    const response = await request(app)
      .post(`/api/v1/projects/${ctx.projectA1Id}/members`)
      .set("Cookie", `access_token=${ctx.adminAToken}`)
      .send({ userId: ctx.adminBId });

    expect(response.status).toBe(404);
  });

  it("rejects adding a duplicate member", async () => {
    const response = await request(app)
      .post(`/api/v1/projects/${ctx.projectA1Id}/members`)
      .set("Cookie", `access_token=${ctx.adminAToken}`)
      .send({ userId: ctx.engineerAId });

    expect(response.status).toBe(409);
  });

  it("rejects adding an inactive user", async () => {
    const response = await request(app)
      .post(`/api/v1/projects/${ctx.projectA1Id}/members`)
      .set("Cookie", `access_token=${ctx.adminAToken}`)
      .send({ userId: ctx.inactiveUserId });

    expect(response.status).toBe(409);
  });

  it("rejects removing a user who is not a member", async () => {
    const response = await request(app)
      .delete(`/api/v1/projects/${ctx.projectA1Id}/members/${ctx.strangerUserId}`)
      .set("Cookie", `access_token=${ctx.adminAToken}`);

    expect(response.status).toBe(404);
  });

  it("does not allow removing the project manager from membership", async () => {
    const response = await request(app)
      .delete(`/api/v1/projects/${ctx.projectA1Id}/members/${ctx.pmAId}`)
      .set("Cookie", `access_token=${ctx.adminAToken}`);

    expect(response.status).toBe(403);
  });

  it("paginates the member list", async () => {
    const addMember1 = await request(app)
      .post(`/api/v1/projects/${ctx.projectA1Id}/members`)
      .set("Cookie", `access_token=${ctx.adminAToken}`)
      .send({ userId: ctx.member1Id });
    const addMember2 = await request(app)
      .post(`/api/v1/projects/${ctx.projectA1Id}/members`)
      .set("Cookie", `access_token=${ctx.adminAToken}`)
      .send({ userId: ctx.member2Id });

    expect(addMember1.status).toBe(201);
    expect(addMember2.status).toBe(201);

    const pageOne = await request(app)
      .get(`/api/v1/projects/${ctx.projectA1Id}/members?page=1&pageSize=2`)
      .set("Cookie", `access_token=${ctx.adminAToken}`);

    expect(pageOne.status).toBe(200);

    const bodyOne = pageOne.body as MemberListEnvelope;
    expect(bodyOne.data.members).toHaveLength(2);
    expect(bodyOne.meta.page).toBe(1);
    expect(bodyOne.meta.pageSize).toBe(2);
    expect(bodyOne.meta.total).toBe(3);

    const pageTwo = await request(app)
      .get(`/api/v1/projects/${ctx.projectA1Id}/members?page=2&pageSize=2`)
      .set("Cookie", `access_token=${ctx.adminAToken}`);

    expect(pageTwo.status).toBe(200);

    const bodyTwo = pageTwo.body as MemberListEnvelope;
    expect(bodyTwo.data.members).toHaveLength(1);
    expect(bodyTwo.meta.total).toBe(3);
  });

  it("never exposes members from another company", async () => {
    const response = await request(app)
      .get(`/api/v1/projects/${ctx.projectA1Id}/members`)
      .set("Cookie", `access_token=${ctx.adminAToken}`);

    expect(response.status).toBe(200);

    const body = response.body as MemberListEnvelope;
    const ids = body.data.members.map((member) => member.userId);

    expect(ids).not.toContain(ctx.adminBId);
  });
});
