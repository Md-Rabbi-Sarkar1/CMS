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

interface DocumentData {
  id: string;
  projectId: string;
  name: string;
  type: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string | null;
  uploadedBy: { id: string };
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

async function createDocument(
  agent: Agent,
  name: string,
  extra: Record<string, unknown> = {},
): Promise<string> {
  const res = await agent.post("/api/v1/documents").send({
    projectId,
    name,
    type: "PERMIT",
    mimeType: "application/pdf",
    sizeBytes: 128,
    ...extra,
  });
  expect(res.status).toBe(201);
  return successBody<DocumentData>(res).data.id;
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

describe("Documents — create metadata", () => {
  it("stores document metadata attributed to the uploader", async () => {
    const id = await createDocument(admin, "blueprint.pdf");

    const res = await admin.get(`/api/v1/documents/${id}`);
    expect(res.status).toBe(200);

    const doc = successBody<DocumentData>(res).data;
    expect(doc.name).toBe("blueprint.pdf");
    expect(doc.projectId).toBe(projectId);
    expect(doc.mimeType).toBe("application/pdf");
    expect(doc.sizeBytes).toBe(128);
    expect(doc.uploadedBy.id).toBe(ctx.user.id);
  });

  it("stores null storage key when not provided (metadata-only phase)", async () => {
    const id = await createDocument(admin, "auto-key.pdf");
    const res = await admin.get(`/api/v1/documents/${id}`);
    expect(successBody<DocumentData>(res).data.storageKey).toBeNull();
  });

  it("accepts an explicit storage key", async () => {
    const id = await createDocument(admin, "explicit.pdf", { storageKey: "docs/explicit.pdf" });
    const res = await admin.get(`/api/v1/documents/${id}`);
    expect(successBody<DocumentData>(res).data.storageKey).toBe("docs/explicit.pdf");
  });

  it("rejects invalid metadata with 400", async () => {
    const negativeSize = await admin.post("/api/v1/documents").send({
      projectId,
      name: "bad.pdf",
      type: "PERMIT",
      mimeType: "application/pdf",
      sizeBytes: -1,
    });
    expect(negativeSize.status).toBe(400);

    const missingName = await admin.post("/api/v1/documents").send({
      projectId,
      type: "PERMIT",
      mimeType: "application/pdf",
      sizeBytes: 1,
    });
    expect(missingName.status).toBe(400);
  });

  it("returns 404 for a non-existent project", async () => {
    const res = await admin.post("/api/v1/documents").send({
      projectId: "00000000-0000-0000-0000-000000000000",
      name: "ghost.pdf",
      type: "PERMIT",
      mimeType: "application/pdf",
      sizeBytes: 1,
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 for a same-company non-member", async () => {
    const res = await outsiderAgent.post("/api/v1/documents").send({
      projectId,
      name: "no-access.pdf",
      type: "PERMIT",
      mimeType: "application/pdf",
      sizeBytes: 1,
    });
    expect(res.status).toBe(404);
  });

  it("allows a WORKER member to create document metadata", async () => {
    const res = await workerAgent.post("/api/v1/documents").send({
      projectId,
      name: "worker.pdf",
      type: "PHOTO",
      mimeType: "application/pdf",
      sizeBytes: 10,
    });
    expect(res.status).toBe(201);
  });

  it("rejects unauthenticated requests with 401", async () => {
    const res = await supertestAgent(app).get("/api/v1/documents");
    expect(res.status).toBe(401);
  });
});

describe("Documents — list, get, delete", () => {
  let docId: string;

  beforeAll(async () => {
    docId = await createDocument(admin, "listed.pdf");
  });

  it("lists company documents", async () => {
    const res = await admin.get("/api/v1/documents");
    expect(res.status).toBe(200);
    const ids = successBody<DocumentData[]>(res).data.map((d) => d.id);
    expect(ids).toContain(docId);
  });

  it("filters by project", async () => {
    const res = await admin.get(`/api/v1/documents?projectId=${projectId}`);
    expect(res.status).toBe(200);
    const docs = successBody<DocumentData[]>(res).data;
    expect(docs.every((d) => d.projectId === projectId)).toBe(true);
  });

  it("returns 404 for a non-existent document", async () => {
    const res = await admin.get("/api/v1/documents/00000000-0000-0000-0000-000000000000");
    expect(res.status).toBe(404);
  });

  it("deletes a document as ADMIN", async () => {
    const id = await createDocument(admin, "delete-admin.pdf");
    const res = await admin.delete(`/api/v1/documents/${id}`);
    expect(res.status).toBe(200);

    const stored = await prisma.document.findUnique({ where: { id } });
    expect(stored).toBeNull();
  });

  it("allows the uploader to delete their own document", async () => {
    const res = await workerAgent.post("/api/v1/documents").send({
      projectId,
      name: "own.pdf",
      type: "PHOTO",
      mimeType: "application/pdf",
      sizeBytes: 10,
    });
    expect(res.status).toBe(201);
    const id = successBody<DocumentData>(res).data.id;

    const del = await workerAgent.delete(`/api/v1/documents/${id}`);
    expect(del.status).toBe(200);
  });

  it("allows the project manager to delete another user's document on their project", async () => {
    const pmUser = await createSecondUser(ctx, "PROJECT_MANAGER");
    const pmAgent = await login(pmUser);
    await admin.patch(`/api/v1/projects/${projectId}`).send({ managerId: pmUser.id }).expect(200);

    const id = await createDocument(admin, "delete-pm.pdf");
    const res = await pmAgent.delete(`/api/v1/documents/${id}`);
    expect(res.status).toBe(200);
  });

  it("hides another user's document from a WORKER on delete (404)", async () => {
    const id = await createDocument(admin, "delete-worker.pdf");
    const res = await workerAgent.delete(`/api/v1/documents/${id}`);
    expect(res.status).toBe(404);
  });
});
