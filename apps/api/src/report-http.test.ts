import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { agent as supertestAgent } from "supertest";

import { prisma } from "./providers/database.js";
import { app } from "./app.js";
import {
  cleanupTestContext,
  errorBody,
  reportData,
  reportPayload,
  setupTestContext,
  successBody,
  type ReportItem,
  type TestContext,
} from "./test-helpers.js";

let ctx: TestContext;

beforeAll(async () => {
  ctx = await setupTestContext("ADMIN");
});

afterAll(async () => {
  await cleanupTestContext(ctx);
  await prisma.$disconnect();
});

describe("Report HTTP — authentication", () => {
  it("rejects unauthenticated POST with 401", async () => {
    const unauth = supertestAgent(app);
    const res = await unauth.post("/api/v1/reports").send(reportPayload(ctx.project.id));
    expect(res.status).toBe(401);
  });

  it("rejects unauthenticated GET list with 401", async () => {
    const unauth = supertestAgent(app);
    const res = await unauth.get("/api/v1/reports");
    expect(res.status).toBe(401);
  });

  it("rejects unauthenticated GET by id with 401", async () => {
    const unauth = supertestAgent(app);
    const res = await unauth.get(`/api/v1/reports/11111111-1111-1111-1111-111111111111`);
    expect(res.status).toBe(401);
  });
});

describe("Report HTTP — create", () => {
  it("creates a report and returns 201 with the report", async () => {
    const res = await ctx.agent.post("/api/v1/reports").send(reportPayload(ctx.project.id));

    expect(res.status).toBe(201);
    const data = reportData(res);
    expect(data.id).toBeTruthy();
    expect(data.projectId).toBe(ctx.project.id);
    expect(data.workers).toHaveLength(1);
  });

  it("returns 400 for an invalid payload", async () => {
    const res = await ctx.agent.post("/api/v1/reports").send({
      projectId: "not-a-uuid",
      reportDate: "bad",
      workCompleted: "",
      hoursWorked: -1,
      progressPct: 200,
      workers: [],
    });

    expect(res.status).toBe(400);
    expect(errorBody(res).success).toBe(false);
  });

  it("returns 404 when the project does not belong to the company", async () => {
    const res = await ctx.agent
      .post("/api/v1/reports")
      .send(reportPayload("22222222-2222-2222-2222-222222222222"));

    expect(res.status).toBe(404);
  });
});

describe("Report HTTP — list", () => {
  it("returns a paginated list of reports", async () => {
    await ctx.agent.post("/api/v1/reports").send(reportPayload(ctx.project.id));

    const res = await ctx.agent.get("/api/v1/reports");

    expect(res.status).toBe(200);
    const body = successBody<ReportItem[]>(res);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    expect(body.meta).toBeTruthy();
  });

  it("filters reports by projectId", async () => {
    const createRes = await ctx.agent
      .post("/api/v1/reports")
      .send(reportPayload(ctx.project.id, { workCompleted: "Filtered report" }));
    const projectId = reportData(createRes).projectId;

    const res = await ctx.agent.get(`/api/v1/reports?projectId=${projectId}`);

    expect(res.status).toBe(200);
    const items = successBody<ReportItem[]>(res).data;
    expect(items.length).toBeGreaterThanOrEqual(1);
    for (const item of items) {
      expect(item.projectId).toBe(projectId);
    }
  });

  it("returns 400 for an invalid query parameter", async () => {
    const res = await ctx.agent.get(`/api/v1/reports?projectId=bad`);
    expect(res.status).toBe(400);
  });

  it("respects pagination query parameters", async () => {
    for (let i = 0; i < 3; i++) {
      await ctx.agent
        .post("/api/v1/reports")
        .send(reportPayload(ctx.project.id, { workCompleted: `Page test ${String(i)}` }));
    }

    const res = await ctx.agent.get(`/api/v1/reports?page=1&pageSize=2`);

    expect(res.status).toBe(200);
    const body = successBody<ReportItem[]>(res);
    expect(body.data).toHaveLength(2);
    expect(body.meta?.page).toBe(1);
    expect(body.meta?.pageSize).toBe(2);
    expect(body.meta?.total).toBeGreaterThanOrEqual(3);
  });
});

describe("Report HTTP — get by id", () => {
  it("returns a report by id", async () => {
    const createRes = await ctx.agent.post("/api/v1/reports").send(reportPayload(ctx.project.id));
    const id = reportData(createRes).id;

    const res = await ctx.agent.get(`/api/v1/reports/${id}`);

    expect(res.status).toBe(200);
    const body = successBody<ReportItem>(res);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(id);
  });

  it("returns 404 for a non-existent report", async () => {
    const res = await ctx.agent.get(`/api/v1/reports/11111111-1111-1111-1111-111111111111`);
    expect(res.status).toBe(404);
  });

  it("returns 400 for an invalid id", async () => {
    const res = await ctx.agent.get(`/api/v1/reports/not-a-uuid`);
    expect(res.status).toBe(400);
  });
});

describe("Report HTTP — update", () => {
  it("updates a report and returns the updated report", async () => {
    const createRes = await ctx.agent.post("/api/v1/reports").send(reportPayload(ctx.project.id));
    const id = reportData(createRes).id;

    const res = await ctx.agent
      .patch(`/api/v1/reports/${id}`)
      .send({ progressPct: 80, workCompleted: "Nearly done." });

    expect(res.status).toBe(200);
    const data = reportData(res);
    expect(data.progressPct).toBe(80);
    expect(data.workCompleted).toBe("Nearly done.");
  });

  it("replaces workers A,B with C,D via PATCH", async () => {
    const createRes = await ctx.agent
      .post("/api/v1/reports")
      .send(reportPayload(ctx.project.id, { workers: [{ name: "Alice" }, { name: "Bob" }] }));
    const id = reportData(createRes).id;

    const res = await ctx.agent
      .patch(`/api/v1/reports/${id}`)
      .send({ workers: [{ name: "Carol" }, { name: "Dave" }] });

    expect(res.status).toBe(200);
    const names = reportData(res)
      .workers.map((w) => w.name)
      .sort();
    expect(names).toEqual(["Carol", "Dave"]);
  });

  it("returns 400 for an invalid update payload", async () => {
    const createRes = await ctx.agent.post("/api/v1/reports").send(reportPayload(ctx.project.id));
    const id = reportData(createRes).id;

    const res = await ctx.agent.patch(`/api/v1/reports/${id}`).send({ progressPct: 200 });

    expect(res.status).toBe(400);
  });

  it("returns 404 when updating a non-existent report", async () => {
    const res = await ctx.agent
      .patch(`/api/v1/reports/11111111-1111-1111-1111-111111111111`)
      .send({ progressPct: 50 });

    expect(res.status).toBe(404);
  });
});

describe("Report HTTP — delete", () => {
  it("deletes a report and returns 200", async () => {
    const createRes = await ctx.agent.post("/api/v1/reports").send(reportPayload(ctx.project.id));
    const id = reportData(createRes).id;

    const deleteRes = await ctx.agent.delete(`/api/v1/reports/${id}`);
    expect(deleteRes.status).toBe(200);

    const getRes = await ctx.agent.get(`/api/v1/reports/${id}`);
    expect(getRes.status).toBe(404);
  });

  it("returns 404 when deleting a non-existent report", async () => {
    const res = await ctx.agent.delete(`/api/v1/reports/11111111-1111-1111-1111-111111111111`);
    expect(res.status).toBe(404);
  });
});
