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

interface IssueData {
  id: string;
  projectId: string;
  title: string;
  status: string;
  priority: string;
  assignee: { id: string } | null;
  reporter: { id: string };
  resolution: string | null;
}

let ctx: TestContext;
let admin: Agent;
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

async function createIssue(
  agent: Agent,
  title: string,
  extra: Record<string, unknown> = {},
): Promise<string> {
  const res = await agent
    .post("/api/v1/issues")
    .send({ projectId, title, description: `${title} description`, ...extra });
  expect(res.status).toBe(201);
  return successBody<IssueData>(res).data.id;
}

beforeAll(async () => {
  ctx = await setupTestContext("ADMIN");
  admin = ctx.agent;
  projectId = ctx.project.id;

  worker = await createSecondUser(ctx, "WORKER");
  outsider = await createSecondUser(ctx, "ENGINEER");

  workerAgent = await login(worker);
  outsiderAgent = await login(outsider);

  await admin.post(`/api/v1/projects/${projectId}/members`).send({ userId: worker.id }).expect(201);
});

afterAll(async () => {
  await cleanupTestContext(ctx);
  await prisma.$disconnect();
});

describe("Issues — create", () => {
  it("creates an OPEN issue attributed to the reporter", async () => {
    const id = await createIssue(admin, "Cracked beam", { priority: "HIGH" });

    const res = await admin.get(`/api/v1/issues/${id}`);
    expect(res.status).toBe(200);

    const issue = successBody<IssueData>(res).data;
    expect(issue.status).toBe("OPEN");
    expect(issue.priority).toBe("HIGH");
    expect(issue.reporter.id).toBe(ctx.user.id);
  });

  it("assigns a same-company assignee on create", async () => {
    const id = await createIssue(admin, "Assigned on create", { assigneeId: worker.id });

    const res = await admin.get(`/api/v1/issues/${id}`);
    expect(successBody<IssueData>(res).data.assignee?.id).toBe(worker.id);
  });

  it("rejects an invalid payload with 400", async () => {
    const res = await admin.post("/api/v1/issues").send({ projectId, title: "No description" });
    expect(res.status).toBe(400);
  });

  it("returns 404 for a non-existent project", async () => {
    const res = await admin.post("/api/v1/issues").send({
      projectId: "00000000-0000-0000-0000-000000000000",
      title: "Ghost",
      description: "No project",
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 for a non-existent assignee", async () => {
    const res = await admin.post("/api/v1/issues").send({
      projectId,
      title: "Ghost assignee",
      description: "Bad assignee",
      assigneeId: "00000000-0000-0000-0000-000000000000",
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 for a same-company non-member creating on the project", async () => {
    const res = await outsiderAgent
      .post("/api/v1/issues")
      .send({ projectId, title: "No access", description: "Not a member" });
    expect(res.status).toBe(404);
  });

  it("rejects unauthenticated requests with 401", async () => {
    const res = await supertestAgent(app)
      .post("/api/v1/issues")
      .send({ projectId, title: "Anon", description: "Anon" });
    expect(res.status).toBe(401);
  });
});

describe("Issues — list and get", () => {
  let listedIssue: string;

  beforeAll(async () => {
    listedIssue = await createIssue(admin, "Listed issue");
  });

  it("lists issues for the company", async () => {
    const res = await admin.get("/api/v1/issues");
    expect(res.status).toBe(200);
    const ids = successBody<IssueData[]>(res).data.map((i) => i.id);
    expect(ids).toContain(listedIssue);
  });

  it("supports status filtering", async () => {
    const res = await admin.get("/api/v1/issues?status=OPEN");
    expect(res.status).toBe(200);
    const issues = successBody<IssueData[]>(res).data;
    expect(issues.every((i) => i.status === "OPEN")).toBe(true);
  });

  it("returns the issue by ID", async () => {
    const res = await admin.get(`/api/v1/issues/${listedIssue}`);
    expect(res.status).toBe(200);
    expect(successBody<IssueData>(res).data.title).toBe("Listed issue");
  });

  it("returns 404 for a non-existent issue", async () => {
    const res = await admin.get("/api/v1/issues/00000000-0000-0000-0000-000000000000");
    expect(res.status).toBe(404);
  });
});

describe("Issues — status lifecycle", () => {
  it("follows OPEN → ASSIGNED → IN_PROGRESS → RESOLVED → CLOSED", async () => {
    const id = await createIssue(admin, "Full lifecycle");

    for (const status of ["ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED"]) {
      const res = await admin.patch(`/api/v1/issues/${id}`).send({ status });
      expect(res.status).toBe(200);
      expect(successBody<IssueData>(res).data.status).toBe(status);
    }
  });

  it("supports the RESOLVED → VERIFIED → CLOSED chain", async () => {
    const id = await createIssue(admin, "Verified chain");

    await admin.patch(`/api/v1/issues/${id}`).send({ status: "IN_PROGRESS" }).expect(200);
    await admin
      .patch(`/api/v1/issues/${id}`)
      .send({ status: "RESOLVED", resolution: "Fixed on site" })
      .expect(200);

    const verified = await admin.patch(`/api/v1/issues/${id}`).send({ status: "VERIFIED" });
    expect(verified.status).toBe(200);
    expect(successBody<IssueData>(verified).data.status).toBe("VERIFIED");

    const closed = await admin.patch(`/api/v1/issues/${id}`).send({ status: "CLOSED" });
    expect(closed.status).toBe(200);
    expect(successBody<IssueData>(closed).data.status).toBe("CLOSED");
  });

  it("rejects an invalid transition IN_PROGRESS → VERIFIED with 409", async () => {
    const id = await createIssue(admin, "Bad jump");
    await admin.patch(`/api/v1/issues/${id}`).send({ status: "IN_PROGRESS" }).expect(200);

    const res = await admin.patch(`/api/v1/issues/${id}`).send({ status: "VERIFIED" });
    expect(res.status).toBe(409);
  });

  it("rejects any transition out of CLOSED with 409", async () => {
    const id = await createIssue(admin, "Closed forever");
    await admin.patch(`/api/v1/issues/${id}`).send({ status: "CLOSED" }).expect(200);

    const res = await admin.patch(`/api/v1/issues/${id}`).send({ status: "OPEN" });
    expect(res.status).toBe(409);
  });
});

describe("Issues — assignment and update", () => {
  it("assigns and unassigns an issue", async () => {
    const id = await createIssue(admin, "Assign later");

    const assigned = await admin.patch(`/api/v1/issues/${id}`).send({ assigneeId: worker.id });
    expect(assigned.status).toBe(200);
    expect(successBody<IssueData>(assigned).data.assignee?.id).toBe(worker.id);

    const unassigned = await admin.patch(`/api/v1/issues/${id}`).send({ assigneeId: null });
    expect(unassigned.status).toBe(200);
    expect(successBody<IssueData>(unassigned).data.assignee).toBeNull();
  });

  it("allows a WORKER to update an issue", async () => {
    const id = await createIssue(admin, "Worker edit");
    const res = await workerAgent.patch(`/api/v1/issues/${id}`).send({ priority: "URGENT" });
    expect(res.status).toBe(200);
    expect(successBody<IssueData>(res).data.priority).toBe("URGENT");
  });

  it("returns 404 when updating a non-existent issue", async () => {
    const res = await admin
      .patch("/api/v1/issues/00000000-0000-0000-0000-000000000000")
      .send({ title: "Ghost" });
    expect(res.status).toBe(404);
  });
});

describe("Issues — delete", () => {
  it("deletes an issue and removes it from the database", async () => {
    const id = await createIssue(admin, "Delete me");
    const res = await admin.delete(`/api/v1/issues/${id}`);
    expect(res.status).toBe(200);

    const stored = await prisma.issue.findUnique({ where: { id } });
    expect(stored).toBeNull();
  });

  it("allows a WORKER to delete an issue (no role restriction at route level)", async () => {
    const id = await createIssue(admin, "Worker delete");
    const res = await workerAgent.delete(`/api/v1/issues/${id}`);
    expect(res.status).toBe(200);
  });
});
