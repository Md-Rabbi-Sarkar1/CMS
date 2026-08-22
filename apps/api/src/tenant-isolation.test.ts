import { afterAll, beforeAll, describe, expect, it } from "vitest";

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

interface IdRow {
  id: string;
  email?: string;
  name?: string;
  title?: string;
}

let companyA: TestContext;
let companyB: TestContext;
let adminA: Agent;
let adminB: Agent;
let userA2: TestUser;

let projectA: string;
let taskA: string;
let materialA: string;
let transactionA: string;
let expenseA: string;
let issueA: string;
let documentA: string;
let inviteEmailA: string;

function mustCreate(res: { status: number; body: unknown }): string {
  expect(res.status).toBe(201);
  return successBody<{ id: string }>(res).data.id;
}

beforeAll(async () => {
  companyA = await setupTestContext("ADMIN");
  companyB = await setupTestContext("ADMIN");
  adminA = companyA.agent;
  adminB = companyB.agent;
  userA2 = await createSecondUser(companyA, "WORKER");

  projectA = companyA.project.id;

  // Seed one of each resource type into Company A through the real API.
  taskA = mustCreate(
    await adminA.post(`/api/v1/projects/${projectA}/tasks`).send({ title: "A task" }),
  );
  materialA = mustCreate(
    await adminA.post("/api/v1/materials").send({ name: "A cement", unit: "bags" }),
  );
  const txRes = await adminA
    .post(`/api/v1/materials/${materialA}/transactions`)
    .send({ type: "PURCHASE", quantity: 10 });
  expect(txRes.status).toBe(201);
  transactionA = successBody<{ transaction: { id: string } }>(txRes).data.transaction.id;
  expenseA = mustCreate(
    await adminA.post("/api/v1/expenses").send({
      projectId: projectA,
      category: "MATERIALS",
      amount: 100,
      description: "A expense",
      expenseDate: "2026-08-22",
    }),
  );
  issueA = mustCreate(
    await adminA.post("/api/v1/issues").send({
      projectId: projectA,
      title: "A issue",
      description: "Issue owned by company A",
    }),
  );
  documentA = mustCreate(
    await adminA.post("/api/v1/documents").send({
      projectId: projectA,
      name: "a-doc.pdf",
      type: "PERMIT",
      mimeType: "application/pdf",
      sizeBytes: 128,
    }),
  );

  await adminA
    .post(`/api/v1/projects/${projectA}/members`)
    .send({ userId: userA2.id })
    .expect(201);

  inviteEmailA = `invitee-a-${String(Date.now())}@test.local`;
  await adminA
    .post("/api/v1/users/invitations")
    .send({ email: inviteEmailA, name: "Invitee A", role: "WORKER" })
    .expect(201);
});

afterAll(async () => {
  await cleanupTestContext(companyA);
  await cleanupTestContext(companyB);
  await prisma.$disconnect();
});

describe("Tenant isolation — projects", () => {
  it("returns 404 when reading another company's project", async () => {
    const res = await adminB.get(`/api/v1/projects/${projectA}`);
    expect(res.status).toBe(404);
  });

  it("returns 404 when updating another company's project", async () => {
    const res = await adminB.patch(`/api/v1/projects/${projectA}`).send({ name: "Hijacked" });
    expect(res.status).toBe(404);
  });

  it("returns 404 when deleting another company's project", async () => {
    const res = await adminB.delete(`/api/v1/projects/${projectA}`);
    expect(res.status).toBe(404);

    const stillThere = await adminA.get(`/api/v1/projects/${projectA}`);
    expect(stillThere.status).toBe(200);
  });

  it("does not include another company's projects in the list", async () => {
    const res = await adminB.get("/api/v1/projects");
    expect(res.status).toBe(200);
    const ids = successBody<IdRow[]>(res).data.map((p) => p.id);
    expect(ids).not.toContain(projectA);
  });

  it("scopes created projects to the caller's company, not a client-supplied companyId", async () => {
    const res = await adminB
      .post("/api/v1/projects")
      .send({ name: "B project", companyId: companyA.company.id });
    // Strict schema rejects foreign keys rather than trusting them.
    expect(res.status).toBe(400);
  });
});

describe("Tenant isolation — project team", () => {
  it("returns 404 when listing members of another company's project", async () => {
    const res = await adminB.get(`/api/v1/projects/${projectA}/members`);
    expect(res.status).toBe(404);
  });

  it("returns 404 when adding a member to another company's project", async () => {
    const res = await adminB
      .post(`/api/v1/projects/${projectA}/members`)
      .send({ userId: companyB.user.id });
    expect(res.status).toBe(404);
  });

  it("returns 404 when removing a member from another company's project", async () => {
    const res = await adminB.delete(`/api/v1/projects/${projectA}/members/${userA2.id}`);
    expect(res.status).toBe(404);
  });

  it("does not let a company B admin add a company A user to a company B project", async () => {
    const res = await adminB
      .post(`/api/v1/projects/${companyB.project.id}/members`)
      .send({ userId: userA2.id });
    expect(res.status).toBe(404);
  });
});

describe("Tenant isolation — tasks", () => {
  it("returns 404 when reading another company's task", async () => {
    const res = await adminB.get(`/api/v1/tasks/${taskA}`);
    expect(res.status).toBe(404);
  });

  it("returns 404 when updating another company's task", async () => {
    const res = await adminB.patch(`/api/v1/tasks/${taskA}`).send({ title: "Hijacked" });
    expect(res.status).toBe(404);
  });

  it("returns 404 when transitioning another company's task status", async () => {
    const res = await adminB.patch(`/api/v1/tasks/${taskA}/status`).send({ status: "IN_PROGRESS" });
    expect(res.status).toBe(404);
  });

  it("returns 404 when deleting another company's task", async () => {
    const res = await adminB.delete(`/api/v1/tasks/${taskA}`);
    expect(res.status).toBe(404);
  });

  it("does not include another company's tasks in the company-wide list", async () => {
    const res = await adminB.get("/api/v1/tasks");
    expect(res.status).toBe(200);
    const ids = successBody<IdRow[]>(res).data.map((t) => t.id);
    expect(ids).not.toContain(taskA);
  });

  it("does not leak another company's tasks through the project task list", async () => {
    // The task list is filtered by the caller's company, so a foreign projectId
    // simply yields an empty list rather than another tenant's data.
    const res = await adminB.get(`/api/v1/projects/${projectA}/tasks`);
    expect(res.status).toBe(200);
    expect(successBody<IdRow[]>(res).data).toHaveLength(0);
  });

  it("returns 404 when creating a task in another company's project", async () => {
    const res = await adminB.post(`/api/v1/projects/${projectA}/tasks`).send({ title: "Intrusion" });
    expect(res.status).toBe(404);
  });

  it("does not let a company B task reference a company A assignee", async () => {
    const res = await adminB
      .post(`/api/v1/projects/${companyB.project.id}/tasks`)
      .send({ title: "Cross assignee", assigneeId: userA2.id });
    expect(res.status).toBe(404);
  });
});

describe("Tenant isolation — materials and inventory", () => {
  it("returns 404 when reading another company's material", async () => {
    const res = await adminB.get(`/api/v1/materials/${materialA}`);
    expect(res.status).toBe(404);
  });

  it("returns 404 when updating another company's material", async () => {
    const res = await adminB.patch(`/api/v1/materials/${materialA}`).send({ name: "Hijacked" });
    expect(res.status).toBe(404);
  });

  it("returns 404 when deleting another company's material", async () => {
    const res = await adminB.delete(`/api/v1/materials/${materialA}`);
    expect(res.status).toBe(404);
  });

  it("returns 404 when recording a transaction on another company's material", async () => {
    const res = await adminB
      .post(`/api/v1/materials/${materialA}/transactions`)
      .send({ type: "USAGE", quantity: 1 });
    expect(res.status).toBe(404);
  });

  it("returns 404 when listing transactions of another company's material", async () => {
    const res = await adminB.get(`/api/v1/materials/${materialA}/transactions`);
    expect(res.status).toBe(404);
  });

  it("does not include another company's materials in the list", async () => {
    const res = await adminB.get("/api/v1/materials");
    expect(res.status).toBe(200);
    const ids = successBody<IdRow[]>(res).data.map((m) => m.id);
    expect(ids).not.toContain(materialA);
  });

  it("keeps the foreign transaction recorded for its own company", async () => {
    const res = await adminA.get(`/api/v1/materials/${materialA}/transactions`);
    expect(res.status).toBe(200);
    const ids = successBody<IdRow[]>(res).data.map((t) => t.id);
    expect(ids).toContain(transactionA);
  });
});

describe("Tenant isolation — expenses", () => {
  it("returns 404 when reading another company's expense", async () => {
    const res = await adminB.get(`/api/v1/expenses/${expenseA}`);
    expect(res.status).toBe(404);
  });

  it("returns 404 when reviewing another company's expense", async () => {
    const res = await adminB
      .patch(`/api/v1/expenses/${expenseA}/review`)
      .send({ status: "APPROVED" });
    expect(res.status).toBe(404);
  });

  it("returns 404 when deleting another company's expense", async () => {
    const res = await adminB.delete(`/api/v1/expenses/${expenseA}`);
    expect(res.status).toBe(404);
  });

  it("does not include another company's expenses in the list", async () => {
    const res = await adminB.get("/api/v1/expenses");
    expect(res.status).toBe(200);
    const ids = successBody<IdRow[]>(res).data.map((e) => e.id);
    expect(ids).not.toContain(expenseA);
  });

  it("returns 404 when creating an expense against another company's project", async () => {
    const res = await adminB.post("/api/v1/expenses").send({
      projectId: projectA,
      category: "OTHER",
      amount: 5,
      description: "Intrusion",
      expenseDate: "2026-08-22",
    });
    expect(res.status).toBe(404);
  });
});

describe("Tenant isolation — issues", () => {
  it("returns 404 when reading another company's issue", async () => {
    const res = await adminB.get(`/api/v1/issues/${issueA}`);
    expect(res.status).toBe(404);
  });

  it("returns 404 when updating another company's issue", async () => {
    const res = await adminB.patch(`/api/v1/issues/${issueA}`).send({ title: "Hijacked" });
    expect(res.status).toBe(404);
  });

  it("returns 404 when deleting another company's issue", async () => {
    const res = await adminB.delete(`/api/v1/issues/${issueA}`);
    expect(res.status).toBe(404);
  });

  it("does not include another company's issues in the list", async () => {
    const res = await adminB.get("/api/v1/issues");
    expect(res.status).toBe(200);
    const ids = successBody<IdRow[]>(res).data.map((i) => i.id);
    expect(ids).not.toContain(issueA);
  });

  it("returns 404 when creating an issue against another company's project", async () => {
    const res = await adminB.post("/api/v1/issues").send({
      projectId: projectA,
      title: "Intrusion",
      description: "Cross-company issue attempt",
    });
    expect(res.status).toBe(404);
  });

  it("does not let a company B issue reference a company A assignee", async () => {
    const res = await adminB.post("/api/v1/issues").send({
      projectId: companyB.project.id,
      title: "Cross assignee",
      description: "Attempt to assign a foreign user",
      assigneeId: userA2.id,
    });
    expect(res.status).toBe(404);
  });
});

describe("Tenant isolation — documents", () => {
  it("returns 404 when reading another company's document", async () => {
    const res = await adminB.get(`/api/v1/documents/${documentA}`);
    expect(res.status).toBe(404);
  });

  it("returns 404 when deleting another company's document", async () => {
    const res = await adminB.delete(`/api/v1/documents/${documentA}`);
    expect(res.status).toBe(404);
  });

  it("does not include another company's documents in the list", async () => {
    const res = await adminB.get("/api/v1/documents");
    expect(res.status).toBe(200);
    const ids = successBody<IdRow[]>(res).data.map((d) => d.id);
    expect(ids).not.toContain(documentA);
  });

  it("returns 404 when creating a document against another company's project", async () => {
    const res = await adminB.post("/api/v1/documents").send({
      projectId: projectA,
      name: "intrusion.pdf",
      type: "PERMIT",
      mimeType: "application/pdf",
      sizeBytes: 64,
    });
    expect(res.status).toBe(404);
  });
});

describe("Tenant isolation — users and invitations", () => {
  it("does not include another company's users in the user list", async () => {
    const res = await adminB.get("/api/v1/users");
    expect(res.status).toBe(200);
    const ids = successBody<IdRow[]>(res).data.map((u) => u.id);
    expect(ids).not.toContain(companyA.user.id);
    expect(ids).not.toContain(userA2.id);
  });

  it("returns 404 when updating another company's user", async () => {
    const res = await adminB.patch(`/api/v1/users/${companyA.user.id}`).send({ role: "WORKER" });
    expect(res.status).toBe(404);

    const unchanged = await prisma.user.findUnique({
      where: { id: companyA.user.id },
      select: { role: true },
    });
    expect(unchanged?.role).toBe("ADMIN");
  });

  it("does not include another company's invitations in the invitation list", async () => {
    const res = await adminB.get("/api/v1/users/invitations");
    expect(res.status).toBe(200);
    const emails = successBody<IdRow[]>(res).data.map((i) => i.email);
    expect(emails).not.toContain(inviteEmailA);
  });
});

describe("Tenant isolation — company profile", () => {
  it("serves only the caller's own company", async () => {
    const resA = await adminA.get("/api/v1/company");
    const resB = await adminB.get("/api/v1/company");
    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);
    expect(successBody<{ id: string }>(resA).data.id).toBe(companyA.company.id);
    expect(successBody<{ id: string }>(resB).data.id).toBe(companyB.company.id);
  });

  it("updates only the caller's own company", async () => {
    const name = `B company renamed ${String(Date.now())}`;
    const res = await adminB.patch("/api/v1/company").send({ name });
    expect(res.status).toBe(200);

    const companyARow = await prisma.company.findUnique({
      where: { id: companyA.company.id },
      select: { name: true },
    });
    expect(companyARow?.name).not.toBe(name);
  });
});

describe("Tenant isolation — analytics", () => {
  it("counts only the caller's own company in the dashboard", async () => {
    const res = await adminB.get("/api/v1/analytics/dashboard");
    expect(res.status).toBe(200);
    const stats = successBody<{
      projects: { total: number };
      tasks: { total: number };
      materials: { total: number };
    }>(res).data;
    expect(stats.projects.total).toBe(1); // only company B's own project
    expect(stats.tasks.total).toBe(0);
    expect(stats.materials.total).toBe(0);
  });

  it("lists only the caller's own projects in project progress", async () => {
    const res = await adminB.get("/api/v1/analytics/project-progress");
    expect(res.status).toBe(200);
    const ids = successBody<IdRow[]>(res).data.map((p) => p.id);
    expect(ids).toContain(companyB.project.id);
    expect(ids).not.toContain(projectA);
  });
});

describe("Tenant isolation — reports (regression spot-check)", () => {
  it("does not include another company's reports in the list", async () => {
    await adminA
      .post("/api/v1/reports")
      .send({
        projectId: projectA,
        reportDate: "2026-08-22",
        workCompleted: "Isolation spot check",
        hoursWorked: 4,
        progressPct: 10,
        workers: [{ name: "Spot", role: "Checker", hoursWorked: 4 }],
      })
      .expect(201);

    const res = await adminB.get("/api/v1/reports");
    expect(res.status).toBe(200);
    expect(successBody<IdRow[]>(res).data).toHaveLength(0);
  });
});
