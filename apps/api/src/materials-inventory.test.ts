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

interface MaterialData {
  id: string;
  name: string;
  unit: string;
  currentStock: string;
  reorderLevel: string;
  lowStock: boolean;
  transactionCount: number;
}

interface TxData {
  id: string;
  materialId: string;
  type: string;
  quantity: string;
  note: string | null;
}

let ctx: TestContext;
let admin: Agent;
let worker: TestUser;
let workerAgent: Agent;

let materialA: string;

async function login(user: TestUser): Promise<Agent> {
  const agent = supertestAgent(app);
  await agent
    .post("/api/v1/auth/login")
    .send({ email: user.email, password: user.password })
    .expect(200);
  return agent;
}

async function createMaterial(name: string, extra: Record<string, unknown> = {}): Promise<string> {
  const res = await admin.post("/api/v1/materials").send({ name, unit: "units", ...extra });
  expect(res.status).toBe(201);
  return successBody<MaterialData>(res).data.id;
}

async function recordTx(
  agent: Agent,
  materialId: string,
  type: string,
  quantity: number,
  extra: Record<string, unknown> = {},
): Promise<{ status: number; material: MaterialData; transaction: TxData }> {
  const res = await agent
    .post(`/api/v1/materials/${materialId}/transactions`)
    .send({ type, quantity, ...extra });
  expect(res.status).toBe(201);
  const data = successBody<{ material: MaterialData; transaction: TxData }>(res).data;
  return { status: res.status, material: data.material, transaction: data.transaction };
}

async function getMaterial(id: string): Promise<MaterialData> {
  const res = await admin.get(`/api/v1/materials/${id}`);
  expect(res.status).toBe(200);
  return successBody<MaterialData>(res).data;
}

beforeAll(async () => {
  ctx = await setupTestContext("ADMIN");
  admin = ctx.agent;

  worker = await createSecondUser(ctx, "WORKER");
  workerAgent = await login(worker);

  materialA = await createMaterial("Cement", { reorderLevel: 5 });
});

afterAll(async () => {
  await cleanupTestContext(ctx);
  await prisma.$disconnect();
});

describe("Materials — CRUD", () => {
  it("creates a material with zero stock and not-low-stock when no reorder level", async () => {
    const id = await createMaterial("Nails");
    const material = await getMaterial(id);
    expect(material.currentStock).toBe("0");
    expect(material.reorderLevel).toBe("0");
    expect(material.lowStock).toBe(false);
  });

  it("rejects a missing name with 400", async () => {
    const res = await admin.post("/api/v1/materials").send({ unit: "bags" });
    expect(res.status).toBe(400);
  });

  it("rejects a negative reorder level with 400", async () => {
    const res = await admin
      .post("/api/v1/materials")
      .send({ name: "Bad", unit: "bags", reorderLevel: -1 });
    expect(res.status).toBe(400);
  });

  it("updates name, unit, and reorder level", async () => {
    const id = await createMaterial("Rename me");
    const res = await admin
      .patch(`/api/v1/materials/${id}`)
      .send({ name: "Renamed", unit: "boxes", reorderLevel: 10 });
    expect(res.status).toBe(200);

    const material = successBody<MaterialData>(res).data;
    expect(material.name).toBe("Renamed");
    expect(material.unit).toBe("boxes");
    expect(material.reorderLevel).toBe("10");
  });

  it("returns 404 for a non-existent material", async () => {
    const ghost = "00000000-0000-0000-0000-000000000000";
    expect((await admin.get(`/api/v1/materials/${ghost}`)).status).toBe(404);
    expect((await admin.patch(`/api/v1/materials/${ghost}`).send({ name: "x" })).status).toBe(404);
    expect((await admin.delete(`/api/v1/materials/${ghost}`)).status).toBe(404);
  });

  it("deletes a material with no transactions", async () => {
    const id = await createMaterial("Disposable");
    const res = await admin.delete(`/api/v1/materials/${id}`);
    expect(res.status).toBe(200);

    const stored = await prisma.material.findUnique({ where: { id } });
    expect(stored).toBeNull();
  });

  it("rejects deleting a material with transactions (409) and keeps it", async () => {
    const id = await createMaterial("Has history");
    await recordTx(admin, id, "PURCHASE", 3);

    const res = await admin.delete(`/api/v1/materials/${id}`);
    expect(res.status).toBe(409);

    const stored = await prisma.material.findUnique({ where: { id } });
    expect(stored).not.toBeNull();
  });

  it("rejects unauthenticated access with 401", async () => {
    expect((await supertestAgent(app).get("/api/v1/materials")).status).toBe(401);
  });

  it("forbids WORKER from creating a material", async () => {
    const res = await workerAgent.post("/api/v1/materials").send({ name: "Worker", unit: "x" });
    expect(res.status).toBe(403);
  });
});

describe("Inventory — transactions and stock arithmetic", () => {
  it("PURCHASE increases stock", async () => {
    const before = await getMaterial(materialA);
    const { material } = await recordTx(admin, materialA, "PURCHASE", 10);
    expect(Number(material.currentStock)).toBe(Number(before.currentStock) + 10);
  });

  it("USAGE decreases stock", async () => {
    const before = await getMaterial(materialA);
    const { material } = await recordTx(admin, materialA, "USAGE", 4);
    expect(Number(material.currentStock)).toBe(Number(before.currentStock) - 4);
  });

  it("ADJUSTMENT increases stock", async () => {
    const before = await getMaterial(materialA);
    const { material } = await recordTx(admin, materialA, "ADJUSTMENT", 2, { note: "Found extra" });
    expect(Number(material.currentStock)).toBe(Number(before.currentStock) + 2);
  });

  it("rejects USAGE beyond available stock with 409 and leaves stock unchanged", async () => {
    const id = await createMaterial("Limited");
    await recordTx(admin, id, "PURCHASE", 3);

    const res = await admin
      .post(`/api/v1/materials/${id}/transactions`)
      .send({ type: "USAGE", quantity: 5 });
    expect(res.status).toBe(409);

    const material = await getMaterial(id);
    expect(material.currentStock).toBe("3");

    const txCount = await prisma.inventoryTransaction.count({ where: { materialId: id } });
    expect(txCount).toBe(1);
  });

  it("rejects non-positive quantities with 400", async () => {
    const res = await admin
      .post(`/api/v1/materials/${materialA}/transactions`)
      .send({ type: "PURCHASE", quantity: 0 });
    expect(res.status).toBe(400);
  });

  it("rejects an invalid transaction type with 400", async () => {
    const res = await admin
      .post(`/api/v1/materials/${materialA}/transactions`)
      .send({ type: "GIFT", quantity: 1 });
    expect(res.status).toBe(400);
  });

  it("rejects a foreign project association with 404", async () => {
    const other = await setupTestContext("ADMIN");
    try {
      const res = await admin
        .post(`/api/v1/materials/${materialA}/transactions`)
        .send({ type: "PURCHASE", quantity: 1, projectId: other.project.id });
      expect(res.status).toBe(404);
    } finally {
      await cleanupTestContext(other);
    }
  });

  it("accepts an optional same-company project association", async () => {
    const { transaction } = await recordTx(admin, materialA, "PURCHASE", 1, {
      projectId: ctx.project.id,
    });
    expect(transaction.materialId).toBe(materialA);
  });

  it("lists transactions in reverse chronological order and stores a note", async () => {
    const id = await createMaterial("Tx list");
    await recordTx(admin, id, "PURCHASE", 5, { note: "First" });
    const second = await recordTx(admin, id, "USAGE", 1, { note: "Second" });

    const res = await admin.get(`/api/v1/materials/${id}/transactions`);
    expect(res.status).toBe(200);

    const txs = successBody<TxData[]>(res).data;
    expect(txs).toHaveLength(2);
    expect(txs[0]?.id).toBe(second.transaction.id);
    expect(txs[0]?.note).toBe("Second");
    expect(txs[1]?.note).toBe("First");
  });

  it("keeps transactions append-only (no update/delete endpoints exist)", async () => {
    const { transaction } = await recordTx(admin, materialA, "PURCHASE", 1);

    const patchRes = await admin
      .patch(`/api/v1/materials/${materialA}/transactions/${transaction.id}`)
      .send({ quantity: 999 });
    expect([404, 405]).toContain(patchRes.status);

    const deleteRes = await admin.delete(`/api/v1/materials/${materialA}/transactions/${transaction.id}`);
    expect([404, 405]).toContain(deleteRes.status);
  });
});

describe("Materials — low-stock filtering", () => {
  it("flags low stock and filters the list", async () => {
    const lowId = await createMaterial("Low item", { reorderLevel: 10 });
    await recordTx(admin, lowId, "PURCHASE", 5);
    const healthyId = await createMaterial("Healthy item", { reorderLevel: 1 });
    await recordTx(admin, healthyId, "PURCHASE", 50);

    const low = await getMaterial(lowId);
    expect(low.lowStock).toBe(true);

    const res = await admin.get("/api/v1/materials?lowStock=true");
    expect(res.status).toBe(200);

    const ids = successBody<MaterialData[]>(res).data.map((m) => m.id);
    expect(ids).toContain(lowId);
    expect(ids).not.toContain(healthyId);
  });
});
