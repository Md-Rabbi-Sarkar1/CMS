import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "./providers/database.js";
import { ReportRepository } from "./repositories/report-repository.js";
import { ReportService, toReportResponse } from "./services/report-service.js";
import {
  cleanupTestContext,
  createSecondProject,
  createSecondUser,
  reportPayload,
  setupTestContext,
  type TestContext,
} from "./test-helpers.js";

let ctx: TestContext;
let repo: ReportRepository;
let service: ReportService;

beforeAll(async () => {
  ctx = await setupTestContext("ADMIN");
  repo = new ReportRepository();
  service = new ReportService();
});

afterAll(async () => {
  await cleanupTestContext(ctx);
  await prisma.$disconnect();
});

afterEach(async () => {
  // Clean only this context's reports to avoid polluting other test files
  // that share the database (each test file uses its own company).
  await prisma.reportWorker.deleteMany({
    where: { report: { project: { companyId: ctx.company.id } } },
  });
  await prisma.dailyWorkReport.deleteMany({
    where: { project: { companyId: ctx.company.id } },
  });
});

beforeEach(() => {
  service = new ReportService();
});

function serviceUser(ctx: TestContext) {
  return { sub: ctx.user.id, companyId: ctx.company.id, role: ctx.user.role };
}

describe("ReportRepository.create", () => {
  it("creates a report with nested workers", async () => {
    const report = await repo.create({
      projectId: ctx.project.id,
      submittedById: ctx.user.id,
      reportDate: new Date("2026-08-12"),
      workCompleted: "Poured concrete.",
      hoursWorked: 8,
      progressPct: 40,
      workers: [{ name: "Alice", role: "Mason", hoursWorked: 8 }],
    });

    expect(report.id).toBeTruthy();
    expect(report.workers).toHaveLength(1);
    expect(report.workers[0]?.name).toBe("Alice");
    expect(report.project.name).toBe(ctx.project.name);
    expect(report.submittedBy.email).toBe(ctx.user.email);
  });

  it("persists hoursWorked as a decimal", async () => {
    const report = await repo.create({
      projectId: ctx.project.id,
      submittedById: ctx.user.id,
      reportDate: new Date("2026-08-12"),
      workCompleted: "Framing.",
      hoursWorked: 7.5,
      progressPct: 50,
      workers: [{ name: "Bob" }],
    });

    expect(report.hoursWorked.toString()).toBe("7.5");
  });

  it("stores nullable optional fields as null when omitted", async () => {
    const report = await repo.create({
      projectId: ctx.project.id,
      submittedById: ctx.user.id,
      reportDate: new Date("2026-08-12"),
      workCompleted: "Work.",
      hoursWorked: 4,
      progressPct: 10,
      workers: [{ name: "Bob" }],
    });

    expect(report.materialsUsed).toBeNull();
    expect(report.problemsEncountered).toBeNull();
    expect(report.notes).toBeNull();
  });
});

describe("ReportRepository.findById / findOwnedById", () => {
  it("finds a report by id with relations", async () => {
    const created = await repo.create({
      projectId: ctx.project.id,
      submittedById: ctx.user.id,
      reportDate: new Date("2026-08-12"),
      workCompleted: "Work.",
      hoursWorked: 4,
      progressPct: 10,
      workers: [{ name: "Bob" }],
    });

    const found = await repo.findById(created.id);
    expect(found?.id).toBe(created.id);
    expect(found?.workers).toHaveLength(1);
  });

  it("returns null for a non-existent id", async () => {
    const found = await repo.findById("11111111-1111-1111-1111-111111111111");
    expect(found).toBeNull();
  });

  it("returns the report when company owns it", async () => {
    const created = await repo.create({
      projectId: ctx.project.id,
      submittedById: ctx.user.id,
      reportDate: new Date("2026-08-12"),
      workCompleted: "Work.",
      hoursWorked: 4,
      progressPct: 10,
      workers: [{ name: "Bob" }],
    });

    const found = await repo.findOwnedById(created.id, ctx.company.id);
    expect(found?.id).toBe(created.id);
  });

  it("returns null when a different company tries to read the report", async () => {
    const created = await repo.create({
      projectId: ctx.project.id,
      submittedById: ctx.user.id,
      reportDate: new Date("2026-08-12"),
      workCompleted: "Work.",
      hoursWorked: 4,
      progressPct: 10,
      workers: [{ name: "Bob" }],
    });

    const found = await repo.findOwnedById(created.id, "22222222-2222-2222-2222-222222222222");
    expect(found).toBeNull();
  });
});

describe("ReportRepository.list", () => {
  it("paginates reports scoped to the company", async () => {
    for (let i = 0; i < 3; i++) {
      await repo.create({
        projectId: ctx.project.id,
        submittedById: ctx.user.id,
        reportDate: new Date("2026-08-12"),
        workCompleted: `Work ${String(i)}`,
        hoursWorked: 4,
        progressPct: 10,
        workers: [{ name: "Bob" }],
      });
    }

    const result = await repo.list({
      page: 1,
      pageSize: 2,
      companyId: ctx.company.id,
    });

    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(3);
  });

  it("filters by projectId", async () => {
    const other = await createSecondProject(ctx, "Other Build");
    await repo.create({
      projectId: ctx.project.id,
      submittedById: ctx.user.id,
      reportDate: new Date("2026-08-12"),
      workCompleted: "A",
      hoursWorked: 4,
      progressPct: 10,
      workers: [{ name: "Bob" }],
    });
    await repo.create({
      projectId: other.id,
      submittedById: ctx.user.id,
      reportDate: new Date("2026-08-12"),
      workCompleted: "B",
      hoursWorked: 4,
      progressPct: 10,
      workers: [{ name: "Bob" }],
    });

    const result = await repo.list({
      page: 1,
      pageSize: 20,
      companyId: ctx.company.id,
      projectId: ctx.project.id,
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.workCompleted).toBe("A");
  });

  it("filters by reportDate range", async () => {
    await repo.create({
      projectId: ctx.project.id,
      submittedById: ctx.user.id,
      reportDate: new Date("2026-08-01"),
      workCompleted: "Early",
      hoursWorked: 4,
      progressPct: 10,
      workers: [{ name: "Bob" }],
    });
    await repo.create({
      projectId: ctx.project.id,
      submittedById: ctx.user.id,
      reportDate: new Date("2026-08-20"),
      workCompleted: "Late",
      hoursWorked: 4,
      progressPct: 10,
      workers: [{ name: "Bob" }],
    });

    const result = await repo.list({
      page: 1,
      pageSize: 20,
      companyId: ctx.company.id,
      reportDateFrom: new Date("2026-08-10"),
      reportDateTo: new Date("2026-08-31"),
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.workCompleted).toBe("Late");
  });

  it("does not leak reports from another company", async () => {
    const result = await repo.list({
      page: 1,
      pageSize: 20,
      companyId: "22222222-2222-2222-2222-222222222222",
    });
    expect(result.total).toBe(0);
  });
});

describe("ReportRepository.updateOwned — atomic worker replacement", () => {
  it("replaces workers A,B with C,D atomically", async () => {
    const created = await repo.create({
      projectId: ctx.project.id,
      submittedById: ctx.user.id,
      reportDate: new Date("2026-08-12"),
      workCompleted: "Work.",
      hoursWorked: 4,
      progressPct: 10,
      workers: [
        { name: "Alice", role: "Mason", hoursWorked: 4 },
        { name: "Bob", role: "Laborer", hoursWorked: 4 },
      ],
    });

    const updated = await repo.updateOwned(created.id, ctx.company.id, {
      workers: [
        { name: "Carol", role: "Foreman", hoursWorked: 8 },
        { name: "Dave", role: "Operator", hoursWorked: 8 },
      ],
    });

    expect(updated).not.toBeNull();
    const workerNames = updated?.workers.map((w) => w.name).sort();
    expect(workerNames).toEqual(["Carol", "Dave"]);

    const orphaned = await prisma.reportWorker.findMany({
      where: { reportId: created.id, name: { in: ["Alice", "Bob"] } },
    });
    expect(orphaned).toHaveLength(0);
  });

  it("removes all workers when an empty list is not allowed (validation prevents empty)", async () => {
    const created = await repo.create({
      projectId: ctx.project.id,
      submittedById: ctx.user.id,
      reportDate: new Date("2026-08-12"),
      workCompleted: "Work.",
      hoursWorked: 4,
      progressPct: 10,
      workers: [{ name: "Alice" }],
    });

    // Repository-level: empty workers array clears all workers.
    await repo.updateOwned(created.id, ctx.company.id, { workers: [] });

    const reloaded = await repo.findById(created.id);
    expect(reloaded?.workers).toHaveLength(0);
  });

  it("updates scalar fields alongside worker replacement", async () => {
    const created = await repo.create({
      projectId: ctx.project.id,
      submittedById: ctx.user.id,
      reportDate: new Date("2026-08-12"),
      workCompleted: "Work.",
      hoursWorked: 4,
      progressPct: 10,
      workers: [{ name: "Alice" }],
    });

    const updated = await repo.updateOwned(created.id, ctx.company.id, {
      progressPct: 90,
      hoursWorked: 9.5,
      workCompleted: "Almost done.",
      workers: [{ name: "Carol" }],
    });

    expect(updated?.progressPct).toBe(90);
    expect(updated?.hoursWorked.toString()).toBe("9.5");
    expect(updated?.workCompleted).toBe("Almost done.");
    expect(updated?.workers).toHaveLength(1);
    expect(updated?.workers[0]?.name).toBe("Carol");
  });

  it("returns null when updating a report owned by another company", async () => {
    const created = await repo.create({
      projectId: ctx.project.id,
      submittedById: ctx.user.id,
      reportDate: new Date("2026-08-12"),
      workCompleted: "Work.",
      hoursWorked: 4,
      progressPct: 10,
      workers: [{ name: "Alice" }],
    });

    const result = await repo.updateOwned(created.id, "22222222-2222-2222-2222-222222222222", {
      progressPct: 99,
    });
    expect(result).toBeNull();
  });
});

describe("ReportRepository.deleteOwned", () => {
  it("deletes a report and its workers", async () => {
    const created = await repo.create({
      projectId: ctx.project.id,
      submittedById: ctx.user.id,
      reportDate: new Date("2026-08-12"),
      workCompleted: "Work.",
      hoursWorked: 4,
      progressPct: 10,
      workers: [{ name: "Alice" }],
    });

    const deleted = await repo.deleteOwned(created.id, ctx.company.id);
    expect(deleted).toBe(true);

    const found = await repo.findById(created.id);
    expect(found).toBeNull();

    const workers = await prisma.reportWorker.findMany({ where: { reportId: created.id } });
    expect(workers).toHaveLength(0);
  });

  it("returns false when deleting a report owned by another company", async () => {
    const created = await repo.create({
      projectId: ctx.project.id,
      submittedById: ctx.user.id,
      reportDate: new Date("2026-08-12"),
      workCompleted: "Work.",
      hoursWorked: 4,
      progressPct: 10,
      workers: [{ name: "Alice" }],
    });

    const deleted = await repo.deleteOwned(created.id, "22222222-2222-2222-2222-222222222222");
    expect(deleted).toBe(false);
  });
});

describe("ReportService.create", () => {
  it("creates a report through the service and returns a response", async () => {
    const payload = reportPayload(ctx.project.id);
    const report = await service.create(serviceUser(ctx), payload as never);

    expect(report.id).toBeTruthy();
    expect(report.projectId).toBe(ctx.project.id);
    expect(report.workers).toHaveLength(1);
    expect(report.hoursWorked).toBe("8");
    expect(report.reportDate).toBe("2026-08-12");
  });

  it("throws NotFoundError when the project belongs to another company", async () => {
    const otherProject = await createSecondProject(ctx, "Rival Build");
    // Re-assign project to a different company to simulate cross-tenant.
    const rival = await prisma.company.create({ data: { slug: `rival-${String(Date.now())}`, name: "Rival" } });
    await prisma.project.update({ where: { id: otherProject.id }, data: { companyId: rival.id } });

    await expect(
      service.create(serviceUser(ctx), reportPayload(otherProject.id) as never),
    ).rejects.toThrow(/Project not found/);

    await prisma.company.delete({ where: { id: rival.id } });
  });
});

describe("ReportService.list / getById", () => {
  it("lists reports scoped to the user company", async () => {
    await service.create(serviceUser(ctx), reportPayload(ctx.project.id) as never);

    const result = await service.list(serviceUser(ctx), { page: 1, pageSize: 20 });
    expect(result.items.length).toBeGreaterThanOrEqual(1);
    expect(result.total).toBeGreaterThanOrEqual(1);
  });

  it("lists reports filtered by submittedById", async () => {
    await service.create(serviceUser(ctx), reportPayload(ctx.project.id) as never);

    const result = await service.list(serviceUser(ctx), {
      page: 1,
      pageSize: 20,
      submittedById: ctx.user.id,
    });
    expect(result.items.length).toBeGreaterThanOrEqual(1);
    for (const item of result.items) {
      expect(item.submittedById).toBe(ctx.user.id);
    }
  });

  it("returns a report by id", async () => {
    const created = await service.create(serviceUser(ctx), reportPayload(ctx.project.id) as never);
    const found = await service.getById(serviceUser(ctx), created.id);
    expect(found.id).toBe(created.id);
  });

  it("throws NotFoundError for a missing report", async () => {
    await expect(
      service.getById(serviceUser(ctx), "11111111-1111-1111-1111-111111111111"),
    ).rejects.toThrow(/not found/);
  });
});

describe("ReportService.update — worker replacement", () => {
  it("replaces workers through the service", async () => {
    const created = await service.create(
      serviceUser(ctx),
      reportPayload(ctx.project.id, {
        workers: [{ name: "Alice" }, { name: "Bob" }],
      }) as never,
    );

    const updated = await service.update(serviceUser(ctx), created.id, {
      workers: [{ name: "Carol" }, { name: "Dave" }],
    });

    const names = updated.workers.map((w) => w.name).sort();
    expect(names).toEqual(["Carol", "Dave"]);
  });

  it("forbids a different user from updating another submitter's report", async () => {
    const created = await service.create(
      serviceUser(ctx),
      reportPayload(ctx.project.id, { workers: [{ name: "Alice" }] }) as never,
    );

    const other = await createSecondUser(ctx, "WORKER");
    const otherUser = { sub: other.id, companyId: ctx.company.id, role: other.role };

    await expect(
      service.update(otherUser, created.id, { progressPct: 50 }),
    ).rejects.toThrow(/not allowed/);
  });

  it("allows a PROJECT_MANAGER to update any report in the company", async () => {
    const worker = await createSecondUser(ctx, "WORKER");
    const workerUser = { sub: worker.id, companyId: ctx.company.id, role: worker.role };
    const created = await service.create(workerUser, reportPayload(ctx.project.id) as never);

    const pm = await createSecondUser(ctx, "PROJECT_MANAGER");
    const pmUser = { sub: pm.id, companyId: ctx.company.id, role: pm.role };

    const updated = await service.update(pmUser, created.id, { progressPct: 75 });
    expect(updated.progressPct).toBe(75);
  });

  it("updates scalar fields without altering the existing worker set", async () => {
    const created = await service.create(
      serviceUser(ctx),
      reportPayload(ctx.project.id, { workers: [{ name: "Alice" }, { name: "Bob" }] }) as never,
    );

    const updated = await service.update(serviceUser(ctx), created.id, { progressPct: 60 });

    expect(updated.progressPct).toBe(60);
    const names = updated.workers.map((w) => w.name).sort();
    expect(names).toEqual(["Alice", "Bob"]);
  });
});

describe("ReportService.delete", () => {
  it("deletes a report owned by the submitter", async () => {
    const created = await service.create(serviceUser(ctx), reportPayload(ctx.project.id) as never);
    await service.delete(serviceUser(ctx), created.id);
    await expect(service.getById(serviceUser(ctx), created.id)).rejects.toThrow(/not found/);
  });

  it("throws NotFoundError for a missing report", async () => {
    await expect(
      service.delete(serviceUser(ctx), "11111111-1111-1111-1111-111111111111"),
    ).rejects.toThrow(/not found/);
  });
});

describe("toReportResponse", () => {
  it("serializes a report with nested workers", async () => {
    const created = await repo.create({
      projectId: ctx.project.id,
      submittedById: ctx.user.id,
      reportDate: new Date("2026-08-12"),
      workCompleted: "Work.",
      hoursWorked: 8.25,
      progressPct: 40,
      workers: [{ name: "Alice", role: "Mason", hoursWorked: 8.25 }],
    });

    const response = toReportResponse(created);
    expect(response.hoursWorked).toBe("8.25");
    expect(response.workers[0]?.hoursWorked).toBe(8.25);
    expect(response.reportDate).toBe("2026-08-12");
    expect(response.project.name).toBe(ctx.project.name);
  });
});
