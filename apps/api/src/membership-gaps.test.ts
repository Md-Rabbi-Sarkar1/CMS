import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { agent as supertestAgent } from "supertest";

import { app } from "./app.js";
import { prisma } from "./providers/database.js";
import {
  cleanupTestContext,
  createSecondUser,
  reportPayload,
  setupTestContext,
  successBody,
  type Agent,
  type TestContext,
  type TestUser,
} from "./test-helpers.js";

interface MemberData {
  userId: string;
  role: string;
}

interface ReportData {
  id: string;
  submittedById: string;
}

interface IssueData {
  id: string;
  status: string;
}

interface TaskData {
  id: string;
  assignee: { id: string } | null;
}

let ctx: TestContext;
let admin: Agent;
let projectId: string;

let memberWorker: TestUser;
let memberWorkerAgent: Agent;
let nonMemberEngineer: TestUser;
let nonMemberEngineerAgent: Agent;
let nonMemberWorker: TestUser;
let nonMemberWorkerAgent: Agent;
let pm: TestUser;
let pmAgent: Agent;

async function login(user: TestUser): Promise<Agent> {
  const agent = supertestAgent(app);
  await agent
    .post("/api/v1/auth/login")
    .send({ email: user.email, password: user.password })
    .expect(200);
  return agent;
}

beforeAll(async () => {
  ctx = await setupTestContext("ADMIN");
  admin = ctx.agent;
  projectId = ctx.project.id;

  memberWorker = await createSecondUser(ctx, "WORKER");
  nonMemberEngineer = await createSecondUser(ctx, "ENGINEER");
  nonMemberWorker = await createSecondUser(ctx, "WORKER");
  pm = await createSecondUser(ctx, "PROJECT_MANAGER");

  memberWorkerAgent = await login(memberWorker);
  nonMemberEngineerAgent = await login(nonMemberEngineer);
  nonMemberWorkerAgent = await login(nonMemberWorker);
  pmAgent = await login(pm);

  await admin
    .post(`/api/v1/projects/${projectId}/members`)
    .send({ userId: memberWorker.id })
    .expect(201);
});

afterAll(async () => {
  await cleanupTestContext(ctx);
  await prisma.$disconnect();
});

describe("Project members — GET /projects/:id/members", () => {
  it("lists members for ADMIN", async () => {
    const res = await admin.get(`/api/v1/projects/${projectId}/members`);
    expect(res.status).toBe(200);
    const ids = successBody<MemberData[]>(res).data.map((m) => m.userId);
    expect(ids).toContain(memberWorker.id);
  });

  it("lists members for a member WORKER", async () => {
    const res = await memberWorkerAgent.get(`/api/v1/projects/${projectId}/members`);
    expect(res.status).toBe(200);
    const ids = successBody<MemberData[]>(res).data.map((m) => m.userId);
    expect(ids).toContain(memberWorker.id);
  });

  it("lists members for the project manager without membership", async () => {
    await admin.patch(`/api/v1/projects/${projectId}`).send({ managerId: pm.id }).expect(200);

    const res = await pmAgent.get(`/api/v1/projects/${projectId}/members`);
    expect(res.status).toBe(200);
  });

  it("returns 404 for a non-member ENGINEER", async () => {
    const res = await nonMemberEngineerAgent.get(`/api/v1/projects/${projectId}/members`);
    expect(res.status).toBe(404);
  });

  it("returns 404 for a non-member WORKER", async () => {
    const res = await nonMemberWorkerAgent.get(`/api/v1/projects/${projectId}/members`);
    expect(res.status).toBe(404);
  });

  it("rejects unauthenticated requests with 401", async () => {
    const res = await supertestAgent(app).get(`/api/v1/projects/${projectId}/members`);
    expect(res.status).toBe(401);
  });
});

describe("Reports — membership and submitter scoping", () => {
  let memberReportId: string;

  beforeAll(async () => {
    const res = await memberWorkerAgent
      .post("/api/v1/reports")
      .send(reportPayload(projectId, { reportDate: "2026-08-23" }));
    expect(res.status).toBe(201);
    memberReportId = successBody<ReportData>(res).data.id;
  });

  it("allows any same-company role to create a report (no membership gate)", async () => {
    // Reports are company-scoped by design: create only requires a same-company
    // project; membership is not checked (unlike tasks/issues/documents).
    const res = await nonMemberWorkerAgent
      .post("/api/v1/reports")
      .send(reportPayload(projectId, { reportDate: "2026-08-24", workCompleted: "Non-member report" }));
    expect(res.status).toBe(201);
  });

  it("allows any company user to read a report by id (company-scoped)", async () => {
    const res = await nonMemberEngineerAgent.get(`/api/v1/reports/${memberReportId}`);
    expect(res.status).toBe(200);
    expect(successBody<ReportData>(res).data.id).toBe(memberReportId);
  });

  it("allows the submitter to update their own report", async () => {
    const res = await memberWorkerAgent
      .patch(`/api/v1/reports/${memberReportId}`)
      .send({ notes: "Updated by submitter" });
    expect(res.status).toBe(200);
  });

  it("forbids a non-submitter WORKER from updating another user's report", async () => {
    const res = await nonMemberWorkerAgent
      .patch(`/api/v1/reports/${memberReportId}`)
      .send({ notes: "Not allowed" });
    expect(res.status).toBe(403);
  });

  it("forbids a non-submitter ENGINEER from deleting another user's report", async () => {
    const res = await nonMemberEngineerAgent.delete(`/api/v1/reports/${memberReportId}`);
    expect(res.status).toBe(403);

    const stored = await prisma.dailyWorkReport.findUnique({ where: { id: memberReportId } });
    expect(stored).not.toBeNull();
  });

  it("allows PROJECT_MANAGER to delete another user's report", async () => {
    const res = await pmAgent.delete(`/api/v1/reports/${memberReportId}`);
    expect(res.status).toBe(200);

    const stored = await prisma.dailyWorkReport.findUnique({ where: { id: memberReportId } });
    expect(stored).toBeNull();
  });
});

describe("Issues — non-member project access", () => {
  let issueId: string;

  beforeAll(async () => {
    const res = await admin.post("/api/v1/issues").send({
      projectId,
      title: "Membership-scoped issue",
      description: "Should not be mutable by non-members",
    });
    expect(res.status).toBe(201);
    issueId = successBody<IssueData>(res).data.id;
  });

  it("returns 404 when a non-member ENGINEER updates an issue on an invisible project", async () => {
    const res = await nonMemberEngineerAgent
      .patch(`/api/v1/issues/${issueId}`)
      .send({ priority: "URGENT" });
    expect(res.status).toBe(404);
  });

  it("returns 404 when a non-member WORKER deletes an issue on an invisible project", async () => {
    const res = await nonMemberWorkerAgent.delete(`/api/v1/issues/${issueId}`);
    expect(res.status).toBe(404);

    const stored = await prisma.issue.findUnique({ where: { id: issueId } });
    expect(stored).not.toBeNull();
  });

  it("still allows a member WORKER to update the issue", async () => {
    const res = await memberWorkerAgent
      .patch(`/api/v1/issues/${issueId}`)
      .send({ priority: "HIGH" });
    expect(res.status).toBe(200);
    expect(successBody<IssueData>(res).data.status).toBe("OPEN");
  });
});

describe("Tasks — project filtering and assignee scoping", () => {
  let assignedTaskId: string;
  let unassignedTaskId: string;

  beforeAll(async () => {
    const assigned = await admin
      .post(`/api/v1/projects/${projectId}/tasks`)
      .send({ title: "Assigned to member worker", assigneeId: memberWorker.id });
    expect(assigned.status).toBe(201);
    assignedTaskId = successBody<TaskData>(assigned).data.id;

    const unassigned = await admin
      .post(`/api/v1/projects/${projectId}/tasks`)
      .send({ title: "Unassigned task" });
    expect(unassigned.status).toBe(201);
    unassignedTaskId = successBody<TaskData>(unassigned).data.id;
  });

  it("WORKER nested project list returns only their assigned tasks", async () => {
    const res = await memberWorkerAgent.get(`/api/v1/projects/${projectId}/tasks`);
    expect(res.status).toBe(200);

    const ids = successBody<TaskData[]>(res).data.map((t) => t.id);
    expect(ids).toContain(assignedTaskId);
    expect(ids).not.toContain(unassignedTaskId);
  });

  it("WORKER global list excludes tasks assigned to nobody or others", async () => {
    const res = await memberWorkerAgent.get("/api/v1/tasks");
    expect(res.status).toBe(200);

    const ids = successBody<TaskData[]>(res).data.map((t) => t.id);
    expect(ids).toContain(assignedTaskId);
    expect(ids).not.toContain(unassignedTaskId);
  });

  it("ADMIN nested project list returns all tasks in that project", async () => {
    const res = await admin.get(`/api/v1/projects/${projectId}/tasks`);
    expect(res.status).toBe(200);

    const ids = successBody<TaskData[]>(res).data.map((t) => t.id);
    expect(ids).toContain(assignedTaskId);
    expect(ids).toContain(unassignedTaskId);
  });

  it("rejects a projectId query param on the global list with 400 (strict schema)", async () => {
    const res = await admin.get(`/api/v1/tasks?projectId=${projectId}`);
    expect(res.status).toBe(400);
  });

  it("ENGINEER global list shows only their own assigned tasks", async () => {
    const res = await nonMemberEngineerAgent.get("/api/v1/tasks");
    expect(res.status).toBe(200);

    const ids = successBody<TaskData[]>(res).data.map((t) => t.id);
    expect(ids).not.toContain(assignedTaskId);
    expect(ids).not.toContain(unassignedTaskId);
  });
});

describe("Auth — refresh token edge cases", () => {
  it("rejects an expired refresh token with 401", async () => {
    const loginRes = await supertestAgent(app)
      .post("/api/v1/auth/login")
      .send({ email: ctx.user.email, password: ctx.user.password });
    expect(loginRes.status).toBe(200);

    const rawCookies: unknown = loginRes.headers["set-cookie"];
    const cookies = (Array.isArray(rawCookies) ? rawCookies : [rawCookies ?? ""]).map(String);
    const refreshLine = cookies.find((c) => c.startsWith("refresh_token="));
    expect(refreshLine).toBeDefined();
    const refreshValue = refreshLine?.split(";")[0]?.split("=")[1] ?? "";
    expect(refreshValue.length).toBeGreaterThan(0);

    // Force-expire every refresh token for this user.
    await prisma.refreshToken.updateMany({
      where: { userId: ctx.user.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    const res = await supertestAgent(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `refresh_token=${refreshValue}`);
    expect(res.status).toBe(401);
  });

  it("rejects replaying an intermediate refresh token after consecutive rotations", async () => {
    const extractRefresh = (headers: Record<string, unknown>): string => {
      const raw: unknown = headers["set-cookie"];
      const cookies = (Array.isArray(raw) ? raw : [raw ?? ""]).map(String);
      return cookies
        .find((c) => c.startsWith("refresh_token="))
        ?.split(";")[0]
        ?.split("=")[1] ?? "";
    };

    const agent = supertestAgent(app);
    await agent
      .post("/api/v1/auth/login")
      .send({ email: ctx.user.email, password: ctx.user.password })
      .expect(200);

    const first = await agent.post("/api/v1/auth/refresh");
    expect(first.status).toBe(200);
    const intermediate = extractRefresh(first.headers);
    expect(intermediate.length).toBeGreaterThan(0);

    // Rotate again: the intermediate token is now revoked.
    const second = await agent.post("/api/v1/auth/refresh");
    expect(second.status).toBe(200);

    const replay = await supertestAgent(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `refresh_token=${intermediate}`);
    expect(replay.status).toBe(401);
  });
});
