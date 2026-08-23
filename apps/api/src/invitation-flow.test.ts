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

interface InvitationData {
  id: string;
  email: string;
  role: string;
  status: string;
  token?: string;
}

let ctxA: TestContext;
let ctxB: TestContext;
let adminA: Agent;
let adminB: Agent;
let pmA: TestUser;
let pmAgentA: Agent;
let inviteCounter = 0;

function nextEmail(prefix: string): string {
  inviteCounter += 1;
  return `${prefix}-${String(inviteCounter)}-${String(Date.now())}@test.local`;
}

async function createInvitation(
  agent: Agent,
  email: string,
  role = "WORKER",
): Promise<{ status: number; data: InvitationData }> {
  const res = await agent.post("/api/v1/users/invitations").send({ email, name: "Invitee", role });
  if (res.status !== 201) {
    return { status: res.status, data: successBody<InvitationData>(res).data };
  }
  return { status: res.status, data: successBody<InvitationData>(res).data };
}

beforeAll(async () => {
  ctxA = await setupTestContext("ADMIN");
  ctxB = await setupTestContext("ADMIN");
  adminA = ctxA.agent;
  adminB = ctxB.agent;
  pmA = await createSecondUser(ctxA, "PROJECT_MANAGER");
  pmAgentA = supertestAgent(app);
  await pmAgentA
    .post("/api/v1/auth/login")
    .send({ email: pmA.email, password: pmA.password })
    .expect(200);
});

afterAll(async () => {
  await cleanupTestContext(ctxA);
  await cleanupTestContext(ctxB);
  await prisma.$disconnect();
});

describe("Invitations — create", () => {
  it("allows ADMIN to create an invitation and returns the plaintext token once", async () => {
    const email = nextEmail("invite");
    const { status, data } = await createInvitation(adminA, email, "ENGINEER");

    expect(status).toBe(201);
    expect(data.email).toBe(email);
    expect(data.role).toBe("ENGINEER");
    expect(data.status).toBe("PENDING");
    expect(typeof data.token).toBe("string");
    expect(data.token?.length).toBeGreaterThan(0);

    const stored = await prisma.invitation.findUnique({ where: { id: data.id } });
    expect(stored?.companyId).toBe(ctxA.company.id);
    expect(stored?.tokenHash).not.toBe(data.token);
  });

  it("forbids non-ADMIN roles from creating invitations", async () => {
    const res = await pmAgentA
      .post("/api/v1/users/invitations")
      .send({ email: nextEmail("invite"), name: "Nope", role: "WORKER" });
    expect(res.status).toBe(403);
  });

  it("rejects a duplicate pending invitation for the same email", async () => {
    const email = nextEmail("dup");
    await adminA
      .post("/api/v1/users/invitations")
      .send({ email, name: "First", role: "WORKER" })
      .expect(201);

    const res = await adminA
      .post("/api/v1/users/invitations")
      .send({ email, name: "Second", role: "WORKER" });
    expect(res.status).toBe(409);
  });

  it("rejects inviting an email that already belongs to a company user", async () => {
    const res = await adminA
      .post("/api/v1/users/invitations")
      .send({ email: ctxA.user.email, name: "Existing", role: "WORKER" });
    expect(res.status).toBe(409);
  });

  it("allows inviting an email that already exists in another company", async () => {
    const res = await adminA
      .post("/api/v1/users/invitations")
      .send({ email: ctxB.user.email, name: "Cross company", role: "WORKER" });
    expect(res.status).toBe(201);
  });

  it("rejects an invalid invitation payload", async () => {
    const res = await adminA
      .post("/api/v1/users/invitations")
      .send({ email: "not-an-email", name: "Bad", role: "SUPERUSER" });
    expect(res.status).toBe(400);
  });

  it("lists only the caller's company invitations", async () => {
    const emailA = nextEmail("list-a");
    await createInvitation(adminA, emailA);

    const resA = await adminA.get("/api/v1/users/invitations");
    expect(resA.status).toBe(200);
    const emailsA = successBody<InvitationData[]>(resA).data.map((i) => i.email);
    expect(emailsA).toContain(emailA);

    const resB = await adminB.get("/api/v1/users/invitations");
    expect(resB.status).toBe(200);
    const emailsB = successBody<InvitationData[]>(resB).data.map((i) => i.email);
    expect(emailsB).not.toContain(emailA);
  });
});

describe("Invitations — verify", () => {
  it("verifies a valid token and returns invitation details without the token", async () => {
    const { data } = await createInvitation(adminA, nextEmail("verify"), "WORKER");

    const res = await supertestAgent(app).get(`/api/v1/users/invitations/verify/${data.token ?? ""}`);
    expect(res.status).toBe(200);

    const verified = successBody<{ email: string; role: string; valid: boolean; token?: string }>(res).data;
    expect(verified.email).toBe(data.email);
    expect(verified.role).toBe("WORKER");
    expect(verified.valid).toBe(true);
    expect(verified.token).toBeUndefined();
  });

  it("returns 404 for an invalid token", async () => {
    const res = await supertestAgent(app).get("/api/v1/users/invitations/verify/deadbeefdeadbeef");
    expect(res.status).toBe(404);
  });

  it("returns 404 for an expired invitation", async () => {
    const { data } = await createInvitation(adminA, nextEmail("expired"));
    await prisma.invitation.update({
      where: { id: data.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    const res = await supertestAgent(app).get(`/api/v1/users/invitations/verify/${data.token ?? ""}`);
    expect(res.status).toBe(404);
  });

  it("returns 404 for an already-used invitation token", async () => {
    const { data } = await createInvitation(adminA, nextEmail("verify-used"));

    await supertestAgent(app)
      .post("/api/v1/users/invitations/accept")
      .send({ token: data.token, name: "Used", password: "Password123!" })
      .expect(200);

    const res = await supertestAgent(app).get(`/api/v1/users/invitations/verify/${data.token ?? ""}`);
    expect(res.status).toBe(404);
  });
});

describe("Invitations — accept", () => {
  it("accepts a valid invitation, creates the user, and they can log in", async () => {
    const email = nextEmail("accept");
    const { data } = await createInvitation(adminA, email, "ENGINEER");

    const res = await supertestAgent(app)
      .post("/api/v1/users/invitations/accept")
      .send({ token: data.token, name: "New Engineer", password: "Password123!" });
    expect(res.status).toBe(200);

    const created = await prisma.user.findFirst({
      where: { email, companyId: ctxA.company.id },
    });
    expect(created).not.toBeNull();
    expect(created?.role).toBe("ENGINEER");

    const invitation = await prisma.invitation.findUnique({ where: { id: data.id } });
    expect(invitation?.status).toBe("ACCEPTED");

    const loginRes = await supertestAgent(app)
      .post("/api/v1/auth/login")
      .send({ email, password: "Password123!" });
    expect(loginRes.status).toBe(200);
  });

  it("rejects an invalid token on accept with 404", async () => {
    const res = await supertestAgent(app)
      .post("/api/v1/users/invitations/accept")
      .send({ token: "deadbeefdeadbeef", name: "Nobody", password: "Password123!" });
    expect(res.status).toBe(404);
  });

  it("rejects accepting an already-used invitation", async () => {
    const { data } = await createInvitation(adminA, nextEmail("used"));

    await supertestAgent(app)
      .post("/api/v1/users/invitations/accept")
      .send({ token: data.token, name: "First", password: "Password123!" })
      .expect(200);

    const res = await supertestAgent(app)
      .post("/api/v1/users/invitations/accept")
      .send({ token: data.token, name: "Second", password: "Password123!" });
    expect(res.status).toBe(404);
  });

  it("rejects accepting an expired invitation", async () => {
    const { data } = await createInvitation(adminA, nextEmail("expired-accept"));
    await prisma.invitation.update({
      where: { id: data.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    const res = await supertestAgent(app)
      .post("/api/v1/users/invitations/accept")
      .send({ token: data.token, name: "Too Late", password: "Password123!" });
    expect(res.status).toBe(409);
  });

  it("rejects an invalid accept payload with 400", async () => {
    const res = await supertestAgent(app)
      .post("/api/v1/users/invitations/accept")
      .send({ token: "whatever", name: "", password: "short" });
    expect(res.status).toBe(400);
  });

  it("ignores a client-supplied email and uses the invitation's email", async () => {
    const email = nextEmail("email-ignored");
    const { data } = await createInvitation(adminA, email);

    const res = await supertestAgent(app)
      .post("/api/v1/users/invitations/accept")
      .send({
        token: data.token,
        name: "Strict",
        password: "Password123!",
        email: "attacker@test.local",
      });
    // The accept schema is strict, so a foreign email field is rejected outright.
    expect(res.status).toBe(400);

    const notCreated = await prisma.user.findFirst({ where: { email: "attacker@test.local" } });
    expect(notCreated).toBeNull();
  });
});

describe("Invitations — cross-company isolation", () => {
  it("does not expose another company's pending invitations in the list", async () => {
    const emailA = nextEmail("cross-list-a");
    await createInvitation(adminA, emailA);

    const resB = await adminB.get("/api/v1/users/invitations");
    expect(resB.status).toBe(200);
    const emailsB = successBody<InvitationData[]>(resB).data.map((i) => i.email);
    expect(emailsB).not.toContain(emailA);
  });

  it("accepted user belongs to the inviting company, not any other", async () => {
    const email = nextEmail("cross-accept");
    const { data } = await createInvitation(adminB, email, "WORKER");

    await supertestAgent(app)
      .post("/api/v1/users/invitations/accept")
      .send({ token: data.token, name: "B Worker", password: "Password123!" })
      .expect(200);

    const user = await prisma.user.findFirst({ where: { email } });
    expect(user?.companyId).toBe(ctxB.company.id);
    expect(user?.companyId).not.toBe(ctxA.company.id);
  });
});
