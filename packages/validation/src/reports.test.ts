import { describe, expect, it } from "vitest";

import {
  createDailyWorkReportSchema,
  reportIdParamsSchema,
  reportListQuerySchema,
  reportWorkerSchema,
  updateDailyWorkReportSchema,
} from "./reports.js";

const UUID = "11111111-1111-1111-1111-111111111111";
const OTHER_UUID = "22222222-2222-2222-2222-222222222222";

const validWorker = { name: "Alice" };
const fullWorker = { name: "Bob", role: "Mason", hoursWorked: 8 };
const baseReport = {
  projectId: UUID,
  reportDate: "2026-08-12",
  workCompleted: "Poured concrete for the foundation.",
  hoursWorked: 8,
  progressPct: 40,
  workers: [validWorker],
};

describe("reportWorkerSchema", () => {
  it("accepts a minimal worker with only a name", () => {
    const result = reportWorkerSchema.safeParse({ name: "Alice" });
    expect(result.success).toBe(true);
  });

  it("accepts a worker with role and hours", () => {
    const result = reportWorkerSchema.safeParse(fullWorker);
    expect(result.success).toBe(true);
  });

  it("trims the worker name", () => {
    const result = reportWorkerSchema.safeParse({ name: "  Alice  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Alice");
    }
  });

  it("rejects an empty name", () => {
    const result = reportWorkerSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a whitespace-only name", () => {
    const result = reportWorkerSchema.safeParse({ name: "   " });
    expect(result.success).toBe(false);
  });

  it("rejects a missing name", () => {
    const result = reportWorkerSchema.safeParse({ role: "Mason" });
    expect(result.success).toBe(false);
  });

  it("rejects a name longer than 255 characters", () => {
    const result = reportWorkerSchema.safeParse({ name: "x".repeat(256) });
    expect(result.success).toBe(false);
  });

  it("accepts a name of exactly 255 characters", () => {
    const result = reportWorkerSchema.safeParse({ name: "x".repeat(255) });
    expect(result.success).toBe(true);
  });

  it("rejects a negative hoursWorked", () => {
    const result = reportWorkerSchema.safeParse({ name: "Alice", hoursWorked: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects hoursWorked greater than 9999.99", () => {
    const result = reportWorkerSchema.safeParse({ name: "Alice", hoursWorked: 10000 });
    expect(result.success).toBe(false);
  });

  it("accepts zero hoursWorked", () => {
    const result = reportWorkerSchema.safeParse({ name: "Alice", hoursWorked: 0 });
    expect(result.success).toBe(true);
  });

  it("rejects an empty role string", () => {
    const result = reportWorkerSchema.safeParse({ name: "Alice", role: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a role longer than 255 characters", () => {
    const result = reportWorkerSchema.safeParse({ name: "Alice", role: "x".repeat(256) });
    expect(result.success).toBe(false);
  });

  it("accepts a role of exactly 255 characters", () => {
    const result = reportWorkerSchema.safeParse({ name: "Alice", role: "x".repeat(255) });
    expect(result.success).toBe(true);
  });

  it("rejects a non-string name", () => {
    const result = reportWorkerSchema.safeParse({ name: 42 });
    expect(result.success).toBe(false);
  });

  it("rejects a non-number hoursWorked", () => {
    const result = reportWorkerSchema.safeParse({ name: "Alice", hoursWorked: "8" });
    expect(result.success).toBe(false);
  });
});

describe("createDailyWorkReportSchema", () => {
  it("accepts a valid minimal report", () => {
    const result = createDailyWorkReportSchema.safeParse(baseReport);
    expect(result.success).toBe(true);
  });

  it("accepts a fully populated report", () => {
    const result = createDailyWorkReportSchema.safeParse({
      ...baseReport,
      materialsUsed: "Cement, sand",
      problemsEncountered: "Rain delay",
      notes: "Need more bricks tomorrow.",
      workers: [validWorker, fullWorker],
    });
    expect(result.success).toBe(true);
  });

  it("accepts multiple workers", () => {
    const result = createDailyWorkReportSchema.safeParse({
      ...baseReport,
      workers: [validWorker, fullWorker, { name: "Carol" }],
    });
    expect(result.success).toBe(true);
  });

  it("accepts progressPct of 0", () => {
    const result = createDailyWorkReportSchema.safeParse({ ...baseReport, progressPct: 0 });
    expect(result.success).toBe(true);
  });

  it("accepts progressPct of 100", () => {
    const result = createDailyWorkReportSchema.safeParse({ ...baseReport, progressPct: 100 });
    expect(result.success).toBe(true);
  });

  it("accepts hoursWorked of 0", () => {
    const result = createDailyWorkReportSchema.safeParse({ ...baseReport, hoursWorked: 0 });
    expect(result.success).toBe(true);
  });

  it("accepts a full ISO datetime reportDate", () => {
    const result = createDailyWorkReportSchema.safeParse({
      ...baseReport,
      reportDate: "2026-08-12T08:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing projectId", () => {
    const { projectId: _omit, ...rest } = baseReport;
    void _omit;
    const result = createDailyWorkReportSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects an invalid projectId", () => {
    const result = createDailyWorkReportSchema.safeParse({ ...baseReport, projectId: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing reportDate", () => {
    const { reportDate: _omit, ...rest } = baseReport;
    void _omit;
    const result = createDailyWorkReportSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects an invalid reportDate", () => {
    const result = createDailyWorkReportSchema.safeParse({ ...baseReport, reportDate: "not-a-date" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty workCompleted", () => {
    const result = createDailyWorkReportSchema.safeParse({ ...baseReport, workCompleted: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a whitespace-only workCompleted", () => {
    const result = createDailyWorkReportSchema.safeParse({ ...baseReport, workCompleted: "   " });
    expect(result.success).toBe(false);
  });

  it("rejects workCompleted longer than 10000 characters", () => {
    const result = createDailyWorkReportSchema.safeParse({
      ...baseReport,
      workCompleted: "x".repeat(10001),
    });
    expect(result.success).toBe(false);
  });

  it("accepts workCompleted of exactly 10000 characters", () => {
    const result = createDailyWorkReportSchema.safeParse({
      ...baseReport,
      workCompleted: "x".repeat(10000),
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing hoursWorked", () => {
    const { hoursWorked: _omit, ...rest } = baseReport;
    void _omit;
    const result = createDailyWorkReportSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects a negative hoursWorked", () => {
    const result = createDailyWorkReportSchema.safeParse({ ...baseReport, hoursWorked: -0.5 });
    expect(result.success).toBe(false);
  });

  it("rejects hoursWorked greater than 9999.99", () => {
    const result = createDailyWorkReportSchema.safeParse({ ...baseReport, hoursWorked: 10000 });
    expect(result.success).toBe(false);
  });

  it("rejects a missing progressPct", () => {
    const { progressPct: _omit, ...rest } = baseReport;
    void _omit;
    const result = createDailyWorkReportSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects a negative progressPct", () => {
    const result = createDailyWorkReportSchema.safeParse({ ...baseReport, progressPct: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects progressPct greater than 100", () => {
    const result = createDailyWorkReportSchema.safeParse({ ...baseReport, progressPct: 101 });
    expect(result.success).toBe(false);
  });

  it("rejects a non-integer progressPct", () => {
    const result = createDailyWorkReportSchema.safeParse({ ...baseReport, progressPct: 40.5 });
    expect(result.success).toBe(false);
  });

  it("rejects materialsUsed longer than 10000 characters", () => {
    const result = createDailyWorkReportSchema.safeParse({
      ...baseReport,
      materialsUsed: "x".repeat(10001),
    });
    expect(result.success).toBe(false);
  });

  it("rejects problemsEncountered longer than 10000 characters", () => {
    const result = createDailyWorkReportSchema.safeParse({
      ...baseReport,
      problemsEncountered: "x".repeat(10001),
    });
    expect(result.success).toBe(false);
  });

  it("rejects notes longer than 10000 characters", () => {
    const result = createDailyWorkReportSchema.safeParse({
      ...baseReport,
      notes: "x".repeat(10001),
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty workers array", () => {
    const result = createDailyWorkReportSchema.safeParse({ ...baseReport, workers: [] });
    expect(result.success).toBe(false);
  });

  it("rejects a missing workers array", () => {
    const { workers: _omit, ...rest } = baseReport;
    void _omit;
    const result = createDailyWorkReportSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects a workers array with an invalid worker", () => {
    const result = createDailyWorkReportSchema.safeParse({
      ...baseReport,
      workers: [{ name: "" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects more than 100 workers", () => {
    const workers = Array.from({ length: 101 }, () => ({ name: "W" }));
    const result = createDailyWorkReportSchema.safeParse({ ...baseReport, workers });
    expect(result.success).toBe(false);
  });

  it("accepts exactly 100 workers", () => {
    const workers = Array.from({ length: 100 }, () => ({ name: "W" }));
    const result = createDailyWorkReportSchema.safeParse({ ...baseReport, workers });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown top-level field (strict)", () => {
    const result = createDailyWorkReportSchema.safeParse({ ...baseReport, unexpected: true });
    expect(result.success).toBe(false);
  });

  it("accepts a non-string workCompleted", () => {
    const result = createDailyWorkReportSchema.safeParse({ ...baseReport, workCompleted: 42 });
    expect(result.success).toBe(false);
  });

  it("trims workCompleted", () => {
    const result = createDailyWorkReportSchema.safeParse({
      ...baseReport,
      workCompleted: "  Poured concrete.  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.workCompleted).toBe("Poured concrete.");
    }
  });

  it("preserves decimal hoursWorked", () => {
    const result = createDailyWorkReportSchema.safeParse({ ...baseReport, hoursWorked: 7.5 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.hoursWorked).toBe(7.5);
    }
  });

  it("accepts hoursWorked exactly 9999.99", () => {
    const result = createDailyWorkReportSchema.safeParse({ ...baseReport, hoursWorked: 9999.99 });
    expect(result.success).toBe(true);
  });

  it("rejects hoursWorked as NaN", () => {
    const result = createDailyWorkReportSchema.safeParse({ ...baseReport, hoursWorked: Number.NaN });
    expect(result.success).toBe(false);
  });

  it("rejects hoursWorked as Infinity", () => {
    const result = createDailyWorkReportSchema.safeParse({ ...baseReport, hoursWorked: Number.POSITIVE_INFINITY });
    expect(result.success).toBe(false);
  });

  it("accepts a worker with a decimal hoursWorked value", () => {
    const result = createDailyWorkReportSchema.safeParse({
      ...baseReport,
      workers: [{ name: "Alice", hoursWorked: 4.25 }],
    });
    expect(result.success).toBe(true);
  });

  it("accepts materialsUsed as an empty string", () => {
    const result = createDailyWorkReportSchema.safeParse({ ...baseReport, materialsUsed: "" });
    expect(result.success).toBe(true);
  });

  it("accepts problemsEncountered as an empty string", () => {
    const result = createDailyWorkReportSchema.safeParse({ ...baseReport, problemsEncountered: "" });
    expect(result.success).toBe(true);
  });

  it("accepts notes as an empty string", () => {
    const result = createDailyWorkReportSchema.safeParse({ ...baseReport, notes: "" });
    expect(result.success).toBe(true);
  });

  it("accepts materialsUsed of exactly 10000 characters", () => {
    const result = createDailyWorkReportSchema.safeParse({
      ...baseReport,
      materialsUsed: "x".repeat(10000),
    });
    expect(result.success).toBe(true);
  });

  it("accepts problemsEncountered of exactly 10000 characters", () => {
    const result = createDailyWorkReportSchema.safeParse({
      ...baseReport,
      problemsEncountered: "x".repeat(10000),
    });
    expect(result.success).toBe(true);
  });

  it("accepts notes of exactly 10000 characters", () => {
    const result = createDailyWorkReportSchema.safeParse({
      ...baseReport,
      notes: "x".repeat(10000),
    });
    expect(result.success).toBe(true);
  });

  it("rejects projectId as a number", () => {
    const result = createDailyWorkReportSchema.safeParse({ ...baseReport, projectId: 123 });
    expect(result.success).toBe(false);
  });

  it("rejects workers as a non-array", () => {
    const result = createDailyWorkReportSchema.safeParse({ ...baseReport, workers: { name: "Alice" } });
    expect(result.success).toBe(false);
  });

  it("rejects workers containing a non-object entry", () => {
    const result = createDailyWorkReportSchema.safeParse({ ...baseReport, workers: ["Alice"] });
    expect(result.success).toBe(false);
  });

  it("rejects workers containing a worker with a non-string role", () => {
    const result = createDailyWorkReportSchema.safeParse({
      ...baseReport,
      workers: [{ name: "Alice", role: 42 }],
    });
    expect(result.success).toBe(false);
  });

  it("trims a worker name inside the workers array", () => {
    const result = createDailyWorkReportSchema.safeParse({
      ...baseReport,
      workers: [{ name: "  Alice  " }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.workers[0]?.name).toBe("Alice");
    }
  });

  it("parses a valid report via .parse() without throwing", () => {
    expect(() => createDailyWorkReportSchema.parse(baseReport)).not.toThrow();
  });

  it("coerces nothing on projectId (must be string UUID)", () => {
    const result = createDailyWorkReportSchema.safeParse({ ...baseReport, projectId: 11111111 });
    expect(result.success).toBe(false);
  });

  it("accepts a worker with hoursWorked exactly 9999.99", () => {
    const result = createDailyWorkReportSchema.safeParse({
      ...baseReport,
      workers: [{ name: "Alice", hoursWorked: 9999.99 }],
    });
    expect(result.success).toBe(true);
  });
});

describe("updateDailyWorkReportSchema", () => {
  it("accepts an empty object (partial update)", () => {
    const result = updateDailyWorkReportSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts updating only workCompleted", () => {
    const result = updateDailyWorkReportSchema.safeParse({ workCompleted: "New work." });
    expect(result.success).toBe(true);
  });

  it("accepts updating only progressPct", () => {
    const result = updateDailyWorkReportSchema.safeParse({ progressPct: 60 });
    expect(result.success).toBe(true);
  });

  it("accepts updating workers", () => {
    const result = updateDailyWorkReportSchema.safeParse({
      workers: [validWorker, fullWorker],
    });
    expect(result.success).toBe(true);
  });

  it("accepts updating reportDate", () => {
    const result = updateDailyWorkReportSchema.safeParse({ reportDate: "2026-08-13" });
    expect(result.success).toBe(true);
  });

  it("accepts updating hoursWorked", () => {
    const result = updateDailyWorkReportSchema.safeParse({ hoursWorked: 7.5 });
    expect(result.success).toBe(true);
  });

  it("accepts updating optional nullable-ish fields to empty strings when allowed", () => {
    const result = updateDailyWorkReportSchema.safeParse({ notes: "Updated notes." });
    expect(result.success).toBe(true);
  });

  it("rejects an empty workCompleted when provided", () => {
    const result = updateDailyWorkReportSchema.safeParse({ workCompleted: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a whitespace-only workCompleted when provided", () => {
    const result = updateDailyWorkReportSchema.safeParse({ workCompleted: "  " });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid reportDate when provided", () => {
    const result = updateDailyWorkReportSchema.safeParse({ reportDate: "not-a-date" });
    expect(result.success).toBe(false);
  });

  it("rejects a negative hoursWorked when provided", () => {
    const result = updateDailyWorkReportSchema.safeParse({ hoursWorked: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects progressPct greater than 100 when provided", () => {
    const result = updateDailyWorkReportSchema.safeParse({ progressPct: 101 });
    expect(result.success).toBe(false);
  });

  it("rejects a non-integer progressPct when provided", () => {
    const result = updateDailyWorkReportSchema.safeParse({ progressPct: 1.5 });
    expect(result.success).toBe(false);
  });

  it("rejects notes longer than 10000 characters when provided", () => {
    const result = updateDailyWorkReportSchema.safeParse({ notes: "x".repeat(10001) });
    expect(result.success).toBe(false);
  });

  it("rejects an empty workers array when provided", () => {
    const result = updateDailyWorkReportSchema.safeParse({ workers: [] });
    expect(result.success).toBe(false);
  });

  it("rejects more than 100 workers when provided", () => {
    const workers = Array.from({ length: 101 }, () => ({ name: "W" }));
    const result = updateDailyWorkReportSchema.safeParse({ workers });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown top-level field (strict)", () => {
    const result = updateDailyWorkReportSchema.safeParse({ unexpected: true });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid worker inside workers when provided", () => {
    const result = updateDailyWorkReportSchema.safeParse({ workers: [{ name: "" }] });
    expect(result.success).toBe(false);
  });

  it("accepts clearing optional fields with undefined", () => {
    const result = updateDailyWorkReportSchema.safeParse({ notes: undefined });
    expect(result.success).toBe(true);
  });

  it("accepts updating materialsUsed", () => {
    const result = updateDailyWorkReportSchema.safeParse({ materialsUsed: "Cement" });
    expect(result.success).toBe(true);
  });

  it("accepts updating problemsEncountered", () => {
    const result = updateDailyWorkReportSchema.safeParse({ problemsEncountered: "None" });
    expect(result.success).toBe(true);
  });

  it("rejects materialsUsed longer than 10000 when provided", () => {
    const result = updateDailyWorkReportSchema.safeParse({ materialsUsed: "x".repeat(10001) });
    expect(result.success).toBe(false);
  });

  it("rejects problemsEncountered longer than 10000 when provided", () => {
    const result = updateDailyWorkReportSchema.safeParse({ problemsEncountered: "x".repeat(10001) });
    expect(result.success).toBe(false);
  });

  it("rejects a non-string workCompleted when provided", () => {
    const result = updateDailyWorkReportSchema.safeParse({ workCompleted: 42 });
    expect(result.success).toBe(false);
  });

  it("rejects a non-number hoursWorked when provided", () => {
    const result = updateDailyWorkReportSchema.safeParse({ hoursWorked: "8" });
    expect(result.success).toBe(false);
  });

  it("rejects a non-number progressPct when provided", () => {
    const result = updateDailyWorkReportSchema.safeParse({ progressPct: "40" });
    expect(result.success).toBe(false);
  });

  it("trims workCompleted when updating", () => {
    const result = updateDailyWorkReportSchema.safeParse({ workCompleted: "  New work.  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.workCompleted).toBe("New work.");
    }
  });

  it("accepts a partial update with multiple fields", () => {
    const result = updateDailyWorkReportSchema.safeParse({
      workCompleted: "Updated work.",
      progressPct: 75,
      hoursWorked: 6,
    });
    expect(result.success).toBe(true);
  });

  it("accepts an empty string for materialsUsed when updating", () => {
    const result = updateDailyWorkReportSchema.safeParse({ materialsUsed: "" });
    expect(result.success).toBe(true);
  });

  it("accepts exactly 100 workers when updating", () => {
    const workers = Array.from({ length: 100 }, () => ({ name: "W" }));
    const result = updateDailyWorkReportSchema.safeParse({ workers });
    expect(result.success).toBe(true);
  });
});

describe("reportIdParamsSchema", () => {
  it("accepts a valid UUID", () => {
    const result = reportIdParamsSchema.safeParse({ id: UUID });
    expect(result.success).toBe(true);
  });

  it("rejects a non-UUID id", () => {
    const result = reportIdParamsSchema.safeParse({ id: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing id", () => {
    const result = reportIdParamsSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("reportListQuerySchema", () => {
  it("applies pagination defaults", () => {
    const result = reportListQuerySchema.parse({});
    expect(result).toEqual({ page: 1, pageSize: 20 });
  });

  it("accepts custom pagination", () => {
    const result = reportListQuerySchema.parse({ page: "2", pageSize: "5" });
    expect(result).toEqual({ page: 2, pageSize: 5 });
  });

  it("caps pageSize at 100", () => {
    const result = reportListQuerySchema.safeParse({ pageSize: 101 });
    expect(result.success).toBe(false);
  });

  it("accepts a projectId filter", () => {
    const result = reportListQuerySchema.safeParse({ projectId: UUID });
    expect(result.success).toBe(true);
  });

  it("accepts a submittedById filter", () => {
    const result = reportListQuerySchema.safeParse({ submittedById: OTHER_UUID });
    expect(result.success).toBe(true);
  });

  it("accepts reportDateFrom and reportDateTo together", () => {
    const result = reportListQuerySchema.safeParse({
      reportDateFrom: "2026-08-01",
      reportDateTo: "2026-08-31",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid projectId filter", () => {
    const result = reportListQuerySchema.safeParse({ projectId: "bad" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid submittedById filter", () => {
    const result = reportListQuerySchema.safeParse({ submittedById: "bad" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid reportDateFrom", () => {
    const result = reportListQuerySchema.safeParse({ reportDateFrom: "nope" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid reportDateTo", () => {
    const result = reportListQuerySchema.safeParse({ reportDateTo: "nope" });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown query field (strict)", () => {
    const result = reportListQuerySchema.safeParse({ unexpected: true });
    expect(result.success).toBe(false);
  });

  it("rejects page less than 1", () => {
    const result = reportListQuerySchema.safeParse({ page: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects a non-positive pageSize", () => {
    const result = reportListQuerySchema.safeParse({ pageSize: 0 });
    expect(result.success).toBe(false);
  });

  it("accepts both projectId and pagination together", () => {
    const result = reportListQuerySchema.parse({ projectId: UUID, page: "3", pageSize: "10" });
    expect(result).toEqual({ page: 3, pageSize: 10, projectId: UUID });
  });
});
