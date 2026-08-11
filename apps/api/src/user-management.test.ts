import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";

import type { CompanyRole } from "@construction-ops/validation";

import { app } from "./app.js";
import { prisma } from "./providers/database.js";
import { hashInvitationToken } from "./utils/invitation-token.js";
import { createAccessToken } from "./utils/jwt.js";
import { hashPassword } from "./utils/password.js";
import { hashRefreshToken } from "./utils/refresh-token.js";

interface UserListEnvelope {
  success: boolean;
  data: {
    users: {
      id: string;
      name: string;
      email: string;
      role: CompanyRole;
      status: "ACTIVE" | "INACTIVE";
    }[];
  };
  meta: { page: number; pageSize: number; total: number };
}

interface InviteEnvelope {
  success: boolean;
  data: {
    id: string;
    email: string;
    role: CompanyRole;
    status: "PENDING" | "ACCEPTED" | "EXPIRED" | "REVOKED";
  };
}

interface UserEnvelope {
  success: boolean;
  data: {
    id: string;
    email: string;
    role: CompanyRole;
    status: "ACTIVE" | "INACTIVE";
  };
}

interface AuthUserEnvelope {
  success: boolean;
  data: {
    id: string;
    email: string;
    role: CompanyRole;
  };
}

interface TestContext {
  companyAId: string;
  companyBId: string;
  adminAId: string;
  adminAEmail: string;
  workerAId: string;
  adminBId: string;
  adminAToken: string;
  workerAToken: string;
  adminBToken: string;
}

let ctx: TestContext;

function futureDate(): Date {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date;
}

function uniqueSuffix(): string {
  return Date.now().toString(36);
}

async function createInvitation(
  companyId: string,
  email: string,
  role: CompanyRole,
  overrides?: {
    status?: "PENDING" | "ACCEPTED" | "EXPIRED" | "REVOKED";
    expiresAt?: Date;
    token?: string;
  },
): Promise<{ token: string; invitationId: string }> {
  const token = overrides?.token ?? `invite-${uniqueSuffix()}-${Math.random().toString(36).slice(2)}`;

  const invitation = await prisma.invitation.create({
    data: {
      companyId,
      email,
      role,
      tokenHash: hashInvitationToken(token),
      status: overrides?.status ?? "PENDING",
      expiresAt: overrides?.expiresAt ?? futureDate(),
    },
  });

  return { token, invitationId: invitation.id };
}

beforeAll(async () => {
  const timestamp = Date.now().toString();
  const companyA = await prisma.company.create({
    data: { name: `Test Co A ${timestamp}`, slug: `test-co-a-${timestamp}` },
  });
  const companyB = await prisma.company.create({
    data: { name: `Test Co B ${timestamp}`, slug: `test-co-b-${timestamp}` },
  });

  const passwordHash = await hashPassword("Password123!");
  const adminAEmail = `admin-a-${timestamp}@test.local`;
  const workerAEmail = `worker-a-${timestamp}@test.local`;
  const adminBEmail = `admin-b-${timestamp}@test.local`;

  const adminA = await prisma.user.create({
    data: { companyId: companyA.id, name: "Admin A", email: adminAEmail, passwordHash, role: "ADMIN" },
  });
  const workerA = await prisma.user.create({
    data: { companyId: companyA.id, name: "Worker A", email: workerAEmail, passwordHash, role: "WORKER" },
  });
  const adminB = await prisma.user.create({
    data: { companyId: companyB.id, name: "Admin B", email: adminBEmail, passwordHash, role: "ADMIN" },
  });

  ctx = {
    companyAId: companyA.id,
    companyBId: companyB.id,
    adminAId: adminA.id,
    adminAEmail,
    workerAId: workerA.id,
    adminBId: adminB.id,
    adminAToken: createAccessToken({ sub: adminA.id, companyId: companyA.id, role: "ADMIN" }),
    workerAToken: createAccessToken({ sub: workerA.id, companyId: companyA.id, role: "WORKER" }),
    adminBToken: createAccessToken({ sub: adminB.id, companyId: companyB.id, role: "ADMIN" }),
  };
});

afterAll(async () => {
  await prisma.company.deleteMany({
    where: { id: { in: [ctx.companyAId, ctx.companyBId] } },
  });
});

describe("user management", () => {
  it("allows an admin to list company users", async () => {
    const response = await request(app)
      .get("/api/v1/users")
      .set("Cookie", `access_token=${ctx.adminAToken}`);

    expect(response.status).toBe(200);

    const body = response.body as UserListEnvelope;
    expect(body.success).toBe(true);
    expect(body.meta.total).toBeGreaterThanOrEqual(2);

    const emails = body.data.users.map((user) => user.email);
    expect(emails).toContain(ctx.adminAEmail);
    expect(emails).not.toContain("admin-b");
  });

  it("rejects non-admin users with 403", async () => {
    const response = await request(app)
      .get("/api/v1/users")
      .set("Cookie", `access_token=${ctx.workerAToken}`);

    expect(response.status).toBe(403);
  });

  it("enforces cross-company isolation on listing and updates", async () => {
    const listResponse = await request(app)
      .get("/api/v1/users")
      .set("Cookie", `access_token=${ctx.adminBToken}`);

    expect(listResponse.status).toBe(200);

    const listBody = listResponse.body as UserListEnvelope;
    const emails = listBody.data.users.map((user) => user.email);
    expect(emails).not.toContain(ctx.adminAEmail);

    const updateResponse = await request(app)
      .patch(`/api/v1/users/${ctx.adminAId}`)
      .set("Cookie", `access_token=${ctx.adminBToken}`)
      .send({ role: "ENGINEER" });

    expect(updateResponse.status).toBe(404);
  });

  it("allows an admin to invite a user", async () => {
    const email = `invitee-${uniqueSuffix()}@test.local`;

    const response = await request(app)
      .post("/api/v1/users/invite")
      .set("Cookie", `access_token=${ctx.adminAToken}`)
      .send({ email, role: "ENGINEER" });

    expect(response.status).toBe(201);

    const body = response.body as InviteEnvelope;
    expect(body.success).toBe(true);
    expect(body.data.email).toBe(email);
    expect(body.data.role).toBe("ENGINEER");
    expect(body.data.status).toBe("PENDING");
  });

  it("returns 409 for a duplicate user email", async () => {
    const response = await request(app)
      .post("/api/v1/users/invite")
      .set("Cookie", `access_token=${ctx.adminAToken}`)
      .send({ email: ctx.adminAEmail, role: "ADMIN" });

    expect(response.status).toBe(409);
  });

  it("returns 409 for a duplicate pending invitation email", async () => {
    const email = `pending-${uniqueSuffix()}@test.local`;

    await createInvitation(ctx.companyAId, email, "WORKER");

    const response = await request(app)
      .post("/api/v1/users/invite")
      .set("Cookie", `access_token=${ctx.adminAToken}`)
      .send({ email, role: "WORKER" });

    expect(response.status).toBe(409);
  });

  it("allows an admin to update a user role", async () => {
    const response = await request(app)
      .patch(`/api/v1/users/${ctx.workerAId}`)
      .set("Cookie", `access_token=${ctx.adminAToken}`)
      .send({ role: "ENGINEER" });

    expect(response.status).toBe(200);

    const body = response.body as UserEnvelope;
    expect(body.data.role).toBe("ENGINEER");
  });

  it("deactivating a user revokes their refresh tokens", async () => {
    const refreshToken = await prisma.refreshToken.create({
      data: {
        userId: ctx.workerAId,
        tokenHash: hashRefreshToken("test-refresh-token"),
        expiresAt: futureDate(),
      },
    });

    const response = await request(app)
      .patch(`/api/v1/users/${ctx.workerAId}`)
      .set("Cookie", `access_token=${ctx.adminAToken}`)
      .send({ status: "INACTIVE" });

    expect(response.status).toBe(200);

    const body = response.body as UserEnvelope;
    expect(body.data.status).toBe("INACTIVE");

    const stored = await prisma.refreshToken.findUnique({ where: { id: refreshToken.id } });
    expect(stored?.revokedAt).not.toBeNull();
  });

  it("accepts a valid invitation and sets authentication cookies", async () => {
    const email = `accept-${uniqueSuffix()}@test.local`;
    const { token, invitationId } = await createInvitation(ctx.companyAId, email, "ENGINEER");

    const response = await request(app)
      .post("/api/v1/auth/accept-invite")
      .send({ token, password: "Password123!" });

    expect(response.status).toBe(200);

    const body = response.body as AuthUserEnvelope;
    expect(body.success).toBe(true);
    expect(body.data.email).toBe(email);
    expect(body.data.role).toBe("ENGINEER");

    const cookies = response.headers["set-cookie"] as unknown as string[] | undefined;

    if (cookies === undefined) {
      throw new Error("Expected set-cookie header");
    }

    expect(cookies.some((cookie) => cookie.includes("access_token="))).toBe(true);
    expect(cookies.some((cookie) => cookie.includes("refresh_token="))).toBe(true);

    const invitation = await prisma.invitation.findUnique({ where: { id: invitationId } });
    expect(invitation?.status).toBe("ACCEPTED");
    expect(invitation?.acceptedAt).not.toBeNull();
  });

  it("rejects an expired invitation", async () => {
    const email = `expired-${uniqueSuffix()}@test.local`;
    const { token } = await createInvitation(ctx.companyAId, email, "WORKER", {
      expiresAt: new Date(Date.now() - 60_000),
    });

    const response = await request(app)
      .post("/api/v1/auth/accept-invite")
      .send({ token, password: "Password123!" });

    expect(response.status).toBe(401);
  });

  it("rejects a revoked invitation", async () => {
    const email = `revoked-${uniqueSuffix()}@test.local`;
    const { token } = await createInvitation(ctx.companyAId, email, "WORKER", {
      status: "REVOKED",
    });

    const response = await request(app)
      .post("/api/v1/auth/accept-invite")
      .send({ token, password: "Password123!" });

    expect(response.status).toBe(401);
  });

  it("rejects an already accepted invitation", async () => {
    const email = `accepted-${uniqueSuffix()}@test.local`;
    const { token } = await createInvitation(ctx.companyAId, email, "WORKER", {
      status: "ACCEPTED",
    });

    const response = await request(app)
      .post("/api/v1/auth/accept-invite")
      .send({ token, password: "Password123!" });

    expect(response.status).toBe(401);
  });

  it("rejects an unknown invitation token", async () => {
    const response = await request(app)
      .post("/api/v1/auth/accept-invite")
      .send({ token: "no-such-token", password: "Password123!" });

    expect(response.status).toBe(401);
  });
});
