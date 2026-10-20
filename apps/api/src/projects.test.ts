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

interface ProjectData {
  id: string;
  name: string;
  status: string;
  companyId?: string;
  managerId: string | null;
  progressPercentage: number;
}

let ctx: TestContext;
let admin: Agent;
let pm: TestUser;
let pmAgent: Agent;
let member: TestUser;
let memberAgent: Agent;
let outsider: TestUser;
let outsiderAgent: Agent;

let mainProject: string;
let planningProject: string;
let pmOwnedProject: string;

async function login(user: TestUser): Promise<Agent> {
  const agent = supertestAgent(app);
  await agent
    .post("/api/v1/auth/login")
    .send({ email: user.email, password: user.password })
    .expect(200);
  return agent;
}

async function createProject(
  agent: Agent,
  name: string,
  extra: Record<string, unknown> = {},
): Promise<string> {
  const res = await agent.post("/api/v1/projects").send({ name, ...extra });
  expect(res.status).toBe(201);
  return successBody<ProjectData>(res).data.id;
}

beforeAll(async () => {
  ctx = await setupTestContext("ADMIN");
  admin = ctx.agent;

  pm = await createSecondUser(ctx, "PROJECT_MANAGER");
  member = await createSecondUser(ctx, "ENGINEER");
  outsider = await createSecondUser(ctx, "ENGINEER");

  pmAgent = await login(pm);
  memberAgent = await login(member);
  outsiderAgent = await login(outsider);

  mainProject = ctx.project.id; // ACTIVE, no members yet
  planningProject = await createProject(admin, "Planning project");
  pmOwnedProject = await createProject(admin, "PM managed", { managerId: pm.id });

  await admin.post(`/api/v1/projects/${mainProject}/members`).send({ userId: member.id }).expect(201);
  await admin.post(`/api/v1/projects/${mainProject}/members`).send({ userId: pm.id }).expect(201);
});

afterAll(async () => {
  await cleanupTestContext(ctx);
  await prisma.$disconnect();
});

describe("Projects — create", () => {
  it("creates a project with defaults scoped to the caller's company", async () => {
    const res = await admin.post("/api/v1/projects").send({ name: "New build" });
    expect(res.status).toBe(201);

    const project = successBody<ProjectData>(res).data;
    expect(project.status).toBe("PLANNING");
    expect(project.progressPercentage).toBe(0);

    const stored = await prisma.project.findUnique({ where: { id: project.id } });
    expect(stored?.companyId).toBe(ctx.company.id);
  });

  it("rejects a missing name with 400", async () => {
    const res = await admin.post("/api/v1/projects").send({ description: "No name" });
    expect(res.status).toBe(400);
  });

  it("rejects a negative budget with 400", async () => {
    const res = await admin.post("/api/v1/projects").send({ name: "Bad budget", budget: -5 });
    expect(res.status).toBe(400);
  });

  it("rejects an invalid status on create with 400", async () => {
    const res = await admin.post("/api/v1/projects").send({ name: "Bad status", status: "ACTIVE" });
    expect(res.status).toBe(400);
  });

  it("returns 404 when assigning a manager from another company", async () => {
    const other = await setupTestContext("ADMIN");
    try {
      const res = await admin
        .post("/api/v1/projects")
        .send({ name: "Cross manager", managerId: other.user.id });
      expect(res.status).toBe(404);
    } finally {
      await cleanupTestContext(other);
    }
  });

  it("rejects assigning a non-project-manager user", async () => {
    const res = await admin
      .post("/api/v1/projects")
      .send({ name: "Engineer manager", managerId: member.id });
    expect(res.status).toBe(404);
  });
});

describe("Projects — list", () => {
  it("returns all company projects for ADMIN", async () => {
    const res = await admin.get("/api/v1/projects");
    expect(res.status).toBe(200);

    const ids = successBody<ProjectData[]>(res).data.map((p) => p.id);
    expect(ids).toContain(mainProject);
    expect(ids).toContain(planningProject);
    expect(ids).toContain(pmOwnedProject);
  });

  it("returns only membership projects for non-ADMIN roles", async () => {
    const memberRes = await memberAgent.get("/api/v1/projects");
    expect(memberRes.status).toBe(200);
    const memberIds = successBody<ProjectData[]>(memberRes).data.map((p) => p.id);
    expect(memberIds).toContain(mainProject);
    expect(memberIds).not.toContain(planningProject);
    expect(memberIds).not.toContain(pmOwnedProject);

    const outsiderRes = await outsiderAgent.get("/api/v1/projects");
    expect(outsiderRes.status).toBe(200);
    expect(successBody<ProjectData[]>(outsiderRes).data).toHaveLength(0);
  });

  it("lists both membership and manager-owned projects for the project manager", async () => {
    const res = await pmAgent.get("/api/v1/projects");
    expect(res.status).toBe(200);
    const ids = successBody<ProjectData[]>(res).data.map((p) => p.id);
    expect(ids).toContain(mainProject);
    expect(ids).not.toContain(planningProject);
    expect(ids).toContain(pmOwnedProject);
  });
});

describe("Projects — get by ID", () => {
  it("returns the project for ADMIN", async () => {
    const res = await admin.get(`/api/v1/projects/${mainProject}`);
    expect(res.status).toBe(200);
    expect(successBody<ProjectData>(res).data.id).toBe(mainProject);
  });

  it("returns the project for a member", async () => {
    const res = await memberAgent.get(`/api/v1/projects/${mainProject}`);
    expect(res.status).toBe(200);
  });

  it("returns the project for its manager even without membership", async () => {
    const res = await pmAgent.get(`/api/v1/projects/${pmOwnedProject}`);
    expect(res.status).toBe(200);
  });

  it("returns 404 for a same-company non-member", async () => {
    const res = await outsiderAgent.get(`/api/v1/projects/${mainProject}`);
    expect(res.status).toBe(404);
  });

  it("returns 404 for a non-existent project", async () => {
    const res = await admin.get("/api/v1/projects/00000000-0000-0000-0000-000000000000");
    expect(res.status).toBe(404);
  });

  it("returns 400 for a malformed project id", async () => {
    const res = await admin.get("/api/v1/projects/not-a-uuid");
    expect(res.status).toBe(400);
  });
});

describe("Projects — update and status transitions", () => {
  it("updates mutable fields", async () => {
    const res = await admin
      .patch(`/api/v1/projects/${planningProject}`)
      .send({ location: "Site 7", budget: 250000 });
    expect(res.status).toBe(200);

    const stored = await prisma.project.findUnique({ where: { id: planningProject } });
    expect(stored?.location).toBe("Site 7");
  });

  it("allows a valid status transition PLANNING → ACTIVE", async () => {
    const res = await admin
      .patch(`/api/v1/projects/${planningProject}`)
      .send({ status: "ACTIVE" });
    expect(res.status).toBe(200);
    expect(successBody<ProjectData>(res).data.status).toBe("ACTIVE");
  });

  it("rejects an invalid status transition with 409", async () => {
    // planningProject is now ACTIVE; ACTIVE → PLANNING is not allowed.
    const res = await admin
      .patch(`/api/v1/projects/${planningProject}`)
      .send({ status: "PLANNING" });
    expect(res.status).toBe(409);
  });

  it("keeps the same status without conflict when unchanged", async () => {
    const res = await admin
      .patch(`/api/v1/projects/${planningProject}`)
      .send({ status: "ACTIVE" });
    expect(res.status).toBe(200);
  });

  it("rejects progress outside 0-100 with 400", async () => {
    const res = await admin
      .patch(`/api/v1/projects/${planningProject}`)
      .send({ progressPercentage: 101 });
    expect(res.status).toBe(400);
  });

  it("returns 404 when updating a non-existent project", async () => {
    const res = await admin
      .patch("/api/v1/projects/00000000-0000-0000-0000-000000000000")
      .send({ name: "Ghost" });
    expect(res.status).toBe(404);
  });
});

describe("Projects — delete", () => {
  it("deletes an empty project as ADMIN", async () => {
    const victim = await createProject(admin, "Disposable");
    const res = await admin.delete(`/api/v1/projects/${victim}`);
    expect(res.status).toBe(200);

    const stored = await prisma.project.findUnique({ where: { id: victim } });
    expect(stored).toBeNull();
  });

  it("returns 404 when deleting a non-existent project", async () => {
    const res = await admin.delete("/api/v1/projects/00000000-0000-0000-0000-000000000000");
    expect(res.status).toBe(404);
  });
});

describe("Projects — authentication", () => {
  it("rejects unauthenticated requests with 401", async () => {
    expect((await supertestAgent(app).get("/api/v1/projects")).status).toBe(401);
    expect((await supertestAgent(app).post("/api/v1/projects").send({ name: "Anon" })).status).toBe(401);
    expect((await supertestAgent(app).get(`/api/v1/projects/${mainProject}`)).status).toBe(401);
  });
});
