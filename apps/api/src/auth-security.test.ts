import jwt from "jsonwebtoken";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { agent as supertestAgent } from "supertest";

import { app } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./providers/database.js";
import {
  cleanupTestContext,
  errorBody,
  setupTestContext,
  successBody,
  type TestContext,
} from "./test-helpers.js";

interface AuthUserData {
  id: string;
  name: string;
  email: string;
  role: string;
  companyId: string;
  passwordHash?: string;
}

let ctx: TestContext;

beforeAll(async () => {
  ctx = await setupTestContext("ADMIN");
});

afterAll(async () => {
  await cleanupTestContext(ctx);
  await prisma.$disconnect();
});

function setCookiesOf(res: { headers: Record<string, unknown> }): string[] {
  const header = res.headers["set-cookie"];
  if (Array.isArray(header)) return header as string[];
  return typeof header === "string" ? [header] : [];
}

function cookieLine(res: { headers: Record<string, unknown> }, name: string): string | undefined {
  return setCookiesOf(res).find((c) => c.startsWith(`${name}=`));
}

function cookieValue(res: { headers: Record<string, unknown> }, name: string): string | undefined {
  const line = cookieLine(res, name);
  return line?.slice(line.indexOf("=") + 1, line.indexOf(";"));
}

function login(email: string, password: string): ReturnType<ReturnType<typeof supertestAgent>["post"]> {
  return supertestAgent(app)
    .post("/api/v1/auth/login")
    .send({ email, password });
}

describe("Auth — login", () => {
  it("logs in with valid credentials and returns the user profile", async () => {
    const res = await login(ctx.user.email, ctx.user.password);
    expect(res.status).toBe(200);

    const user = successBody<AuthUserData>(res).data;
    expect(user.id).toBe(ctx.user.id);
    expect(user.email).toBe(ctx.user.email);
    expect(user.role).toBe("ADMIN");
    expect(user.companyId).toBe(ctx.company.id);
    expect(user.passwordHash).toBeUndefined();
  });

  it("sets HttpOnly SameSite=Strict cookies with expiry", async () => {
    const res = await login(ctx.user.email, ctx.user.password);
    expect(res.status).toBe(200);

    const access = cookieLine(res, "access_token");
    const refresh = cookieLine(res, "refresh_token");
    expect(access).toBeTruthy();
    expect(refresh).toBeTruthy();

    for (const line of [access, refresh]) {
      expect(line).toContain("HttpOnly");
      expect(line).toContain("SameSite=Strict");
      expect(line).toContain("Path=/");
      expect(line).toContain("Max-Age=");
      // secure is only enabled in production (env.NODE_ENV), not in tests.
      expect(line).not.toContain("Secure");
    }

    // 15 minutes for the access token, 7 days for the refresh token.
    expect(access).toContain("Max-Age=900");
    expect(refresh).toContain("Max-Age=604800");
  });

  it("rejects a wrong password with 401 and does not set cookies", async () => {
    const res = await login(ctx.user.email, "WrongPassword123!");
    expect(res.status).toBe(401);
    expect(errorBody(res).error.code).toBe("UNAUTHORIZED");
    expect(setCookiesOf(res)).toHaveLength(0);
  });

  it("rejects an unknown email with the same 401 as a wrong password", async () => {
    const wrongPassword = await login(ctx.user.email, "WrongPassword123!");
    const unknownEmail = await login(`nobody-${String(Date.now())}@test.local`, "Password123!");

    expect(unknownEmail.status).toBe(401);
    expect(errorBody(unknownEmail).error.message).toBe(errorBody(wrongPassword).error.message);
  });

  it("rejects an invalid payload with 400", async () => {
    const res = await supertestAgent(app)
      .post("/api/v1/auth/login")
      .send({ email: "not-an-email", password: "x" });
    expect(res.status).toBe(400);
    expect(errorBody(res).error.code).toBe("VALIDATION_ERROR");
  });
});

describe("Auth — me", () => {
  it("returns the authenticated user with their company", async () => {
    const res = await ctx.agent.get("/api/v1/auth/me");
    expect(res.status).toBe(200);

    const user = successBody<AuthUserData & { company: { id: string } }>(res).data;
    expect(user.id).toBe(ctx.user.id);
    expect(user.company.id).toBe(ctx.company.id);
  });

  it("rejects an unauthenticated request with 401", async () => {
    const res = await supertestAgent(app).get("/api/v1/auth/me");
    expect(res.status).toBe(401);
    expect(errorBody(res).error.code).toBe("UNAUTHORIZED");
  });
});

describe("Auth — refresh", () => {
  it("rotates the refresh token and issues a fresh access token", async () => {
    const loginRes = await login(ctx.user.email, ctx.user.password);
    expect(loginRes.status).toBe(200);

    const refreshBefore = cookieValue(loginRes, "refresh_token");
    expect(refreshBefore).toBeTruthy();

    const res = await supertestAgent(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `refresh_token=${refreshBefore ?? ""}`);
    expect(res.status).toBe(200);
    expect(cookieLine(res, "access_token")).toBeTruthy();

    const refreshAfter = cookieValue(res, "refresh_token");
    expect(refreshAfter).toBeTruthy();
    expect(refreshAfter).not.toBe(refreshBefore);
  });

  it("rejects reuse of the rotated-out refresh token", async () => {
    const loginRes = await login(ctx.user.email, ctx.user.password);
    expect(loginRes.status).toBe(200);

    const oldRefresh = cookieValue(loginRes, "refresh_token");
    expect(oldRefresh).toBeTruthy();

    await supertestAgent(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `refresh_token=${oldRefresh ?? ""}`)
      .expect(200);

    const reuse = await supertestAgent(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `refresh_token=${oldRefresh ?? ""}`);
    expect(reuse.status).toBe(401);
  });

  it("rejects a tampered refresh token with 401", async () => {
    const loginRes = await login(ctx.user.email, ctx.user.password);
    expect(loginRes.status).toBe(200);

    const refresh = cookieValue(loginRes, "refresh_token") ?? "";
    const tampered = `${refresh.slice(0, -2)}${refresh.endsWith("aa") ? "bb" : "aa"}`;

    const res = await supertestAgent(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `refresh_token=${tampered}`);
    expect(res.status).toBe(401);
  });

  it("rejects a missing refresh token with 401", async () => {
    const res = await supertestAgent(app).post("/api/v1/auth/refresh");
    expect(res.status).toBe(401);
  });

  it("rejects a JWT presented as a refresh token", async () => {
    const fake = jwt.sign(
      { sub: ctx.user.id, companyId: ctx.company.id, role: "ADMIN" },
      env.JWT_ACCESS_SECRET,
    );
    const res = await supertestAgent(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `refresh_token=${fake}`);
    expect(res.status).toBe(401);
  });
});

describe("Auth — logout", () => {
  it("clears both cookies and revokes the refresh token", async () => {
    const loginRes = await login(ctx.user.email, ctx.user.password);
    expect(loginRes.status).toBe(200);

    const refresh = cookieValue(loginRes, "refresh_token");

    const res = await supertestAgent(app)
      .post("/api/v1/auth/logout")
      .set("Cookie", `refresh_token=${refresh ?? ""}`);
    expect(res.status).toBe(200);

    const clearedAccess = cookieLine(res, "access_token");
    const clearedRefresh = cookieLine(res, "refresh_token");
    expect(clearedAccess).toMatch(/^access_token=;/);
    expect(clearedRefresh).toMatch(/^refresh_token=;/);

    const reuse = await supertestAgent(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `refresh_token=${refresh ?? ""}`);
    expect(reuse.status).toBe(401);
  });

  it("succeeds without a session (idempotent)", async () => {
    const res = await supertestAgent(app).post("/api/v1/auth/logout");
    expect(res.status).toBe(200);
  });
});

describe("Auth — access token security", () => {
  function accessRequest(token: string): ReturnType<ReturnType<typeof supertestAgent>["get"]> {
    return supertestAgent(app)
      .get("/api/v1/auth/me")
      .set("Cookie", `access_token=${token}`);
  }

  it("rejects a tampered access token", async () => {
    const token = jwt.sign(
      { sub: ctx.user.id, companyId: ctx.company.id, role: "ADMIN" },
      env.JWT_ACCESS_SECRET,
    );
    const tampered = `${token.slice(0, -2)}${token.endsWith("aa") ? "bb" : "aa"}`;

    const res = await accessRequest(tampered);
    expect(res.status).toBe(401);
    expect(errorBody(res).error.code).toBe("UNAUTHORIZED");
  });

  it("rejects a token signed with the wrong secret", async () => {
    const token = jwt.sign(
      { sub: ctx.user.id, companyId: ctx.company.id, role: "ADMIN" },
      "a-completely-different-secret-key-12345",
    );

    const res = await accessRequest(token);
    expect(res.status).toBe(401);
  });

  it("rejects an expired access token", async () => {
    const token = jwt.sign(
      { sub: ctx.user.id, companyId: ctx.company.id, role: "ADMIN" },
      env.JWT_ACCESS_SECRET,
      { expiresIn: -10 },
    );

    const res = await accessRequest(token);
    expect(res.status).toBe(401);
  });

  it("rejects a well-formed token whose payload is missing required claims", async () => {
    const token = jwt.sign({ sub: ctx.user.id }, env.JWT_ACCESS_SECRET);

    const res = await accessRequest(token);
    expect(res.status).toBe(401);
  });

  it("rejects a garbage token", async () => {
    const res = await accessRequest("not-a-jwt-at-all");
    expect(res.status).toBe(401);
  });
});
