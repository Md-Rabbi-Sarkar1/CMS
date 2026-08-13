import bcrypt from "bcryptjs";
import type { Test } from "supertest";
import { agent as supertestAgent } from "supertest";

import { prisma } from "./providers/database.js";
import { app } from "./app.js";
import type { CompanyRole } from "./types/auth.js";

export interface TestUser {
  id: string;
  email: string;
  password: string;
  role: CompanyRole;
  companyId: string;
}

export interface TestProject {
  id: string;
  name: string;
  companyId: string;
}

export interface TestContext {
  company: { id: string; slug: string };
  user: TestUser;
  project: TestProject;
  agent: ReturnType<typeof supertestAgent>;
}

const SALT_ROUNDS = 12;
const TEST_PASSWORD = "Password123!";

function uniqueEmail(prefix: string): string {
  return `${prefix}+${String(Date.now())}-${Math.random().toString(36).slice(2, 8)}@test.local`;
}

async function createCompany(slug: string): Promise<{ id: string; slug: string }> {
  const company = await prisma.company.create({
    data: { slug, name: `Company ${slug}` },
    select: { id: true, slug: true },
  });
  return company;
}

async function createUser(
  companyId: string,
  role: CompanyRole,
  emailPrefix: string,
): Promise<TestUser> {
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, SALT_ROUNDS);
  const email = uniqueEmail(emailPrefix);
  const user = await prisma.user.create({
    data: {
      companyId,
      name: `${emailPrefix} ${role}`,
      email,
      passwordHash,
      role,
    },
    select: { id: true, email: true, role: true, companyId: true },
  });
  return { ...user, password: TEST_PASSWORD };
}

async function createProject(companyId: string, name: string): Promise<TestProject> {
  const project = await prisma.project.create({
    data: {
      companyId,
      name,
      status: "ACTIVE",
    },
    select: { id: true, name: true, companyId: true },
  });
  return project;
}

export async function setupTestContext(role: CompanyRole = "ADMIN"): Promise<TestContext> {
  const slug = `t-${String(Date.now())}-${Math.random().toString(36).slice(2, 8)}`;
  const company = await createCompany(slug);
  const user = await createUser(company.id, role, role.toLowerCase());
  const project = await createProject(company.id, "Sunrise Tower");

  const agent = supertestAgent(app);
  await agent
    .post("/api/v1/auth/login")
    .send({ email: user.email, password: user.password })
    .expect(200);

  return { company, user, project, agent };
}

export async function cleanupTestContext(ctx: TestContext): Promise<void> {
  await prisma.company.deleteMany({ where: { id: ctx.company.id } });
}

export async function createSecondUser(ctx: TestContext, role: CompanyRole): Promise<TestUser> {
  return createUser(ctx.company.id, role, role.toLowerCase());
}

export async function createSecondProject(ctx: TestContext, name: string): Promise<TestProject> {
  return createProject(ctx.company.id, name);
}

export function reportPayload(projectId: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    projectId,
    reportDate: "2026-08-12",
    workCompleted: "Poured concrete for the foundation.",
    hoursWorked: 8,
    progressPct: 40,
    workers: [{ name: "Alice", role: "Mason", hoursWorked: 8 }],
    ...overrides,
  };
}

export type Agent = ReturnType<typeof supertestAgent>;
export type { Test };

export interface ApiSuccessBody<T = unknown> {
  success: true;
  data: T;
  meta?: { page: number; pageSize: number; total: number };
}

export interface ApiErrorBody {
  success: false;
  error: { code: string; message: string; details?: { field: string; message: string }[] };
}

export interface ReportItem {
  id: string;
  projectId: string;
  submittedById: string;
  reportDate: string;
  workCompleted: string;
  hoursWorked: string;
  progressPct: number;
  workers: { name: string; role: string | null; hoursWorked: number | null }[];
}

export function successBody<T = unknown>(res: { body: unknown }): ApiSuccessBody<T> {
  return res.body as ApiSuccessBody<T>;
}

export function reportData(res: { body: unknown }): ReportItem {
  return (res.body as ApiSuccessBody<ReportItem>).data;
}

export function errorBody(res: { body: unknown }): ApiErrorBody {
  return res.body as ApiErrorBody;
}
