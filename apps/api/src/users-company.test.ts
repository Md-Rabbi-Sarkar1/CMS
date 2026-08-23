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

interface UserData {
  id: string;
  name: string;
  email: string;
  role: string;
  companyId: string;
}

interface CompanyData {
  id: string;
  name: string;
  slug: string;
}

let ctx: TestContext;
let admin: Agent;
let pm: TestUser;
let pmAgent: Agent;
let engineer: TestUser;
let worker: TestUser;

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

  pm = await createSecondUser(ctx, "PROJECT_MANAGER");
  engineer = await createSecondUser(ctx, "ENGINEER");
  worker = await createSecondUser(ctx, "WORKER");

  pmAgent = await login(pm);
});

afterAll(async () => {
  await cleanupTestContext(ctx);
  await prisma.$disconnect();
});

describe("Users — list", () => {
  it("lists all company users for ADMIN", async () => {
    const res = await admin.get("/api/v1/users");
    expect(res.status).toBe(200);

    const ids = successBody<UserData[]>(res).data.map((u) => u.id);
    expect(ids).toContain(ctx.user.id);
    expect(ids).toContain(pm.id);
    expect(ids).toContain(engineer.id);
    expect(ids).toContain(worker.id);
  });

  it("supports role filtering", async () => {
    const res = await admin.get("/api/v1/users?role=ENGINEER");
    expect(res.status).toBe(200);

    const users = successBody<UserData[]>(res).data;
    expect(users.length).toBeGreaterThan(0);
    expect(users.every((u) => u.role === "ENGINEER")).toBe(true);
  });

  it("rejects an invalid role filter with 400", async () => {
    const res = await admin.get("/api/v1/users?role=SUPERUSER");
    expect(res.status).toBe(400);
  });

  it("does not leak password hashes", async () => {
    const res = await admin.get("/api/v1/users");
    const users = successBody<(UserData & { passwordHash?: string })[]>(res).data;
    for (const user of users) {
      expect(user.passwordHash).toBeUndefined();
    }
  });

  it("rejects unauthenticated requests with 401", async () => {
    const res = await supertestAgent(app).get("/api/v1/users");
    expect(res.status).toBe(401);
  });
});

describe("Users — role changes", () => {
  it("allows ADMIN to change another user's role", async () => {
    const target = await createSecondUser(ctx, "WORKER");

    const res = await admin.patch(`/api/v1/users/${target.id}`).send({ role: "ENGINEER" });
    expect(res.status).toBe(200);
    expect(successBody<UserData>(res).data.role).toBe("ENGINEER");

    const stored = await prisma.user.findUnique({ where: { id: target.id } });
    expect(stored?.role).toBe("ENGINEER");
  });

  it("prevents an ADMIN from changing their own role", async () => {
    const res = await admin.patch(`/api/v1/users/${ctx.user.id}`).send({ role: "WORKER" });
    expect(res.status).toBe(403);

    const stored = await prisma.user.findUnique({ where: { id: ctx.user.id } });
    expect(stored?.role).toBe("ADMIN");
  });

  it("returns 404 for a non-existent user", async () => {
    const res = await admin
      .patch("/api/v1/users/00000000-0000-0000-0000-000000000000")
      .send({ role: "ENGINEER" });
    expect(res.status).toBe(404);
  });

  it("rejects an invalid role value with 400", async () => {
    const res = await admin.patch(`/api/v1/users/${engineer.id}`).send({ role: "SUPERUSER" });
    expect(res.status).toBe(400);
  });
});

describe("Company — profile", () => {
  it("returns the caller's own company profile", async () => {
    const res = await admin.get("/api/v1/company");
    expect(res.status).toBe(200);

    const company = successBody<CompanyData>(res).data;
    expect(company.id).toBe(ctx.company.id);
  });

  it("allows ADMIN to update the company profile", async () => {
    const name = `Renamed ${String(Date.now())}`;
    const res = await admin.patch("/api/v1/company").send({ name });
    expect(res.status).toBe(200);
    expect(successBody<CompanyData>(res).data.name).toBe(name);

    const stored = await prisma.company.findUnique({ where: { id: ctx.company.id } });
    expect(stored?.name).toBe(name);
  });

  it("rejects non-ADMIN company updates with 403", async () => {
    const res = await pmAgent.patch("/api/v1/company").send({ name: "PM rename" });
    expect(res.status).toBe(403);
  });

  it("rejects an empty name with 400", async () => {
    const res = await admin.patch("/api/v1/company").send({ name: "" });
    expect(res.status).toBe(400);
  });

  it("ignores a client-supplied companyId (strict schema)", async () => {
    const other = await setupTestContext("ADMIN");
    try {
      const res = await admin
        .patch("/api/v1/company")
        .send({ name: "Injection", companyId: other.company.id });
      expect(res.status).toBe(400);

      const storedOther = await prisma.company.findUnique({ where: { id: other.company.id } });
      expect(storedOther?.name).not.toBe("Injection");
    } finally {
      await cleanupTestContext(other);
    }
  });

  it("rejects unauthenticated access with 401", async () => {
    expect((await supertestAgent(app).get("/api/v1/company")).status).toBe(401);
    expect((await supertestAgent(app).patch("/api/v1/company").send({ name: "x" })).status).toBe(401);
  });
});
