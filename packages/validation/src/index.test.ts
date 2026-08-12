import { describe, expect, it } from "vitest";

import {
  acceptInvitationSchema,
  addProjectMemberSchema,
  canTransitionProjectStatus,
  canTransitionTaskStatus,
  createInvitationSchema,
  createProjectSchema,
  createTaskSchema,
  listProjectMembersQuerySchema,
  listProjectsQuerySchema,
  listTasksQuerySchema,
  listUsersQuerySchema,
  loginSchema,
  paginationQuerySchema,
  taskPrioritySchema,
  taskStatusSchema,
  updateCompanySchema,
  updateProjectProgressSchema,
  updateProjectSchema,
  updateProjectStatusSchema,
  updateTaskSchema,
  updateTaskStatusSchema,
  updateUserSchema,
} from "./index.js";

describe("validation package", () => {
  it("applies pagination defaults", () => {
    const result = paginationQuerySchema.parse({});

    expect(result).toEqual({ page: 1, pageSize: 20 });
  });

  it("accepts valid login credentials", () => {
    const result = loginSchema.safeParse({
      email: "admin@demo.local",
      password: "Password123!",
    });

    expect(result.success).toBe(true);
  });

  it("rejects an invalid email", () => {
    const result = loginSchema.safeParse({
      email: "not-an-email",
      password: "Password123!",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a short password", () => {
    const result = loginSchema.safeParse({
      email: "admin@demo.local",
      password: "short",
    });

    expect(result.success).toBe(false);
  });

  it("accepts a partial company update", () => {
    const result = updateCompanySchema.safeParse({
      name: "Demo Construction Co.",
      contactInfo: "contact@demo.local",
    });

    expect(result.success).toBe(true);
  });

  it("allows clearing nullable company fields with null", () => {
    const result = updateCompanySchema.safeParse({
      logoUrl: null,
      address: null,
    });

    expect(result.success).toBe(true);
    expect(result.success && result.data.logoUrl).toBeNull();
  });

  it("rejects an empty company name", () => {
    const result = updateCompanySchema.safeParse({ name: "  " });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid logo URL", () => {
    const result = updateCompanySchema.safeParse({ logoUrl: "not-a-url" });

    expect(result.success).toBe(false);
  });

  it("accepts an empty update object", () => {
    const result = updateCompanySchema.safeParse({});

    expect(result.success).toBe(true);
  });

  it("accepts a valid invitation", () => {
    const result = createInvitationSchema.safeParse({
      email: "worker@demo.local",
      role: "WORKER",
    });

    expect(result.success).toBe(true);
  });

  it("rejects an invalid invitation email", () => {
    const result = createInvitationSchema.safeParse({
      email: "not-an-email",
      role: "ADMIN",
    });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid invitation role", () => {
    const result = createInvitationSchema.safeParse({
      email: "worker@demo.local",
      role: "SUPERVISOR",
    });

    expect(result.success).toBe(false);
  });

  it("accepts a valid invitation acceptance", () => {
    const result = acceptInvitationSchema.safeParse({
      token: "some-invite-token",
      password: "Password123!",
    });

    expect(result.success).toBe(true);
  });

  it("rejects a missing invitation token", () => {
    const result = acceptInvitationSchema.safeParse({
      password: "Password123!",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a short invitation acceptance password", () => {
    const result = acceptInvitationSchema.safeParse({
      token: "some-invite-token",
      password: "short",
    });

    expect(result.success).toBe(false);
  });

  it("accepts a role-only user update", () => {
    const result = updateUserSchema.safeParse({ role: "PROJECT_MANAGER" });

    expect(result.success).toBe(true);
  });

  it("accepts a status-only user update", () => {
    const result = updateUserSchema.safeParse({ status: "INACTIVE" });

    expect(result.success).toBe(true);
  });

  it("accepts an empty user update object", () => {
    const result = updateUserSchema.safeParse({});

    expect(result.success).toBe(true);
  });

  it("rejects an invalid user role", () => {
    const result = updateUserSchema.safeParse({ role: "OWNER" });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid user status", () => {
    const result = updateUserSchema.safeParse({ status: "DELETED" });

    expect(result.success).toBe(false);
  });

  it("applies user list query defaults and accepts filters", () => {
    const result = listUsersQuerySchema.parse({
      search: "  alex  ",
      role: "ADMIN",
      status: "ACTIVE",
    });

    expect(result).toEqual({ page: 1, pageSize: 20, search: "alex", role: "ADMIN", status: "ACTIVE" });
  });

  it("rejects an invalid user list role filter", () => {
    const result = listUsersQuerySchema.safeParse({ role: "SUPERVISOR" });

    expect(result.success).toBe(false);
  });

  it("accepts a full project create payload", () => {
    const result = createProjectSchema.safeParse({
      name: "Riverside Bridge",
      description: "Reinforced concrete bridge",
      location: "Riverside",
      clientInfo: "City Council",
      startDate: "2026-09-01",
      expectedEndDate: "2027-03-15",
      budget: 250000,
      managerId: "9f3e6b9a-1b9f-4e7a-9f22-5e1b9d6c2a88",
    });

    expect(result.success).toBe(true);
  });

  it("accepts a minimal project create payload", () => {
    const result = createProjectSchema.safeParse({ name: "Warehouse Extension" });

    expect(result.success).toBe(true);
  });

  it("rejects a project without a name", () => {
    const result = createProjectSchema.safeParse({});

    expect(result.success).toBe(false);
  });

  it("rejects a blank project name", () => {
    const result = createProjectSchema.safeParse({ name: "   " });

    expect(result.success).toBe(false);
  });

  it("rejects a project name longer than 255 characters", () => {
    const result = createProjectSchema.safeParse({ name: "x".repeat(256) });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid project start date", () => {
    const result = createProjectSchema.safeParse({ name: "Test Project", startDate: "not-a-date" });

    expect(result.success).toBe(false);
  });

  it("rejects a negative project budget", () => {
    const result = createProjectSchema.safeParse({ name: "Test Project", budget: -10 });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid project manager ID", () => {
    const result = createProjectSchema.safeParse({ name: "Test Project", managerId: "not-a-uuid" });

    expect(result.success).toBe(false);
  });

  it("accepts a partial project update", () => {
    const result = updateProjectSchema.safeParse({ name: "Renamed Project" });

    expect(result.success).toBe(true);
  });

  it("allows clearing nullable project fields with null", () => {
    const result = updateProjectSchema.safeParse({ location: null, managerId: null });

    expect(result.success).toBe(true);
    expect(result.success && result.data.location).toBeNull();
  });

  it("rejects an empty project update", () => {
    const result = updateProjectSchema.safeParse({});

    expect(result.success).toBe(false);
  });

  it("rejects an invalid project update status field", () => {
    const result = updateProjectSchema.safeParse({ name: 42 });

    expect(result.success).toBe(false);
  });

  it("accepts a valid project status update", () => {
    const result = updateProjectStatusSchema.safeParse({ status: "ACTIVE" });

    expect(result.success).toBe(true);
  });

  it("rejects an invalid project status", () => {
    const result = updateProjectStatusSchema.safeParse({ status: "DELETED" });

    expect(result.success).toBe(false);
  });

  it("accepts a zero project progress update", () => {
    const result = updateProjectProgressSchema.safeParse({ progressPercentage: 0 });

    expect(result.success).toBe(true);
  });

  it("accepts a 100 project progress update", () => {
    const result = updateProjectProgressSchema.safeParse({ progressPercentage: 100 });

    expect(result.success).toBe(true);
  });

  it("rejects a negative project progress", () => {
    const result = updateProjectProgressSchema.safeParse({ progressPercentage: -1 });

    expect(result.success).toBe(false);
  });

  it("rejects a project progress above 100", () => {
    const result = updateProjectProgressSchema.safeParse({ progressPercentage: 101 });

    expect(result.success).toBe(false);
  });

  it("rejects a non-integer project progress", () => {
    const result = updateProjectProgressSchema.safeParse({ progressPercentage: 33.5 });

    expect(result.success).toBe(false);
  });

  it("applies project list query defaults and accepts filters", () => {
    const result = listProjectsQuerySchema.parse({
      search: "  bridge  ",
      status: "ACTIVE",
      sort: "createdAt:desc",
    });

    expect(result).toEqual({
      page: 1,
      pageSize: 20,
      search: "bridge",
      status: "ACTIVE",
      sort: "createdAt:desc",
    });
  });

  it("rejects an invalid project list sort", () => {
    const result = listProjectsQuerySchema.safeParse({ sort: "budget:desc" });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid project list status filter", () => {
    const result = listProjectsQuerySchema.safeParse({ status: "DRAFT" });

    expect(result.success).toBe(false);
  });

  it("allows a project transition from PLANNING to ACTIVE", () => {
    expect(canTransitionProjectStatus("PLANNING", "ACTIVE")).toBe(true);
  });

  it("allows a project transition from PLANNING to CANCELLED", () => {
    expect(canTransitionProjectStatus("PLANNING", "CANCELLED")).toBe(true);
  });

  it("allows project transitions from ACTIVE", () => {
    expect(canTransitionProjectStatus("ACTIVE", "ON_HOLD")).toBe(true);
    expect(canTransitionProjectStatus("ACTIVE", "COMPLETED")).toBe(true);
    expect(canTransitionProjectStatus("ACTIVE", "CANCELLED")).toBe(true);
  });

  it("allows project transitions from ON_HOLD", () => {
    expect(canTransitionProjectStatus("ON_HOLD", "ACTIVE")).toBe(true);
    expect(canTransitionProjectStatus("ON_HOLD", "CANCELLED")).toBe(true);
  });

  it("forbids moving from COMPLETED", () => {
    expect(canTransitionProjectStatus("COMPLETED", "ACTIVE")).toBe(false);
    expect(canTransitionProjectStatus("COMPLETED", "CANCELLED")).toBe(false);
  });

  it("forbids moving from CANCELLED", () => {
    expect(canTransitionProjectStatus("CANCELLED", "ACTIVE")).toBe(false);
    expect(canTransitionProjectStatus("CANCELLED", "PLANNING")).toBe(false);
  });

  it("forbids skipping PLANNING to ON_HOLD or COMPLETED", () => {
    expect(canTransitionProjectStatus("PLANNING", "ON_HOLD")).toBe(false);
    expect(canTransitionProjectStatus("PLANNING", "COMPLETED")).toBe(false);
  });

  it("forbids moving a project backwards to PLANNING", () => {
    expect(canTransitionProjectStatus("ACTIVE", "PLANNING")).toBe(false);
    expect(canTransitionProjectStatus("ON_HOLD", "PLANNING")).toBe(false);
  });

  it("accepts a valid project member user ID", () => {
    const result = addProjectMemberSchema.safeParse({
      userId: "9f3e6b9a-1b9f-4e7a-9f22-5e1b9d6c2a88",
    });

    expect(result.success).toBe(true);
  });

  it("rejects a missing project member user ID", () => {
    const result = addProjectMemberSchema.safeParse({});

    expect(result.success).toBe(false);
  });

  it("rejects an invalid project member user ID", () => {
    const result = addProjectMemberSchema.safeParse({ userId: "not-a-uuid" });

    expect(result.success).toBe(false);
  });

  it("rejects a non-string project member user ID", () => {
    const result = addProjectMemberSchema.safeParse({ userId: 42 });

    expect(result.success).toBe(false);
  });

  it("applies project member list query defaults", () => {
    const result = listProjectMembersQuerySchema.parse({});

    expect(result).toEqual({ page: 1, pageSize: 20 });
  });

  it("coerces project member list query pagination values", () => {
    const result = listProjectMembersQuerySchema.parse({ page: "2", pageSize: "50" });

    expect(result).toEqual({ page: 2, pageSize: 50 });
  });

  it("rejects a project member list page below 1", () => {
    const result = listProjectMembersQuerySchema.safeParse({ page: 0 });

    expect(result.success).toBe(false);
  });

  it("rejects a project member list page size above 100", () => {
    const result = listProjectMembersQuerySchema.safeParse({ pageSize: 101 });

    expect(result.success).toBe(false);
  });

  it("rejects a non-numeric project member list page", () => {
    const result = listProjectMembersQuerySchema.safeParse({ page: "abc" });

    expect(result.success).toBe(false);
  });

  it("accepts each valid task priority", () => {
    for (const priority of ["LOW", "MEDIUM", "HIGH", "URGENT"] as const) {
      expect(taskPrioritySchema.safeParse(priority).success).toBe(true);
    }
  });

  it("rejects an invalid task priority", () => {
    expect(taskPrioritySchema.safeParse("CRITICAL").success).toBe(false);
  });

  it("accepts each valid task status", () => {
    for (const status of ["TODO", "IN_PROGRESS", "BLOCKED", "REVIEW", "COMPLETED"] as const) {
      expect(taskStatusSchema.safeParse(status).success).toBe(true);
    }
  });

  it("rejects an invalid task status", () => {
    expect(taskStatusSchema.safeParse("ARCHIVED").success).toBe(false);
  });

  it("accepts a full task create payload", () => {
    const result = createTaskSchema.safeParse({
      title: "Rebar layout for slab B",
      description: "Lay rebar according to structural drawings",
      assigneeId: "9f3e6b9a-1b9f-4e7a-9f22-5e1b9d6c2a88",
      priority: "HIGH",
      startDate: "2026-09-01",
      dueDate: "2026-09-10",
    });

    expect(result.success).toBe(true);
  });

  it("accepts a minimal task create payload", () => {
    const result = createTaskSchema.safeParse({ title: "Order concrete" });

    expect(result.success).toBe(true);
  });

  it("rejects a task without a title", () => {
    const result = createTaskSchema.safeParse({});

    expect(result.success).toBe(false);
  });

  it("rejects a blank task title", () => {
    const result = createTaskSchema.safeParse({ title: "   " });

    expect(result.success).toBe(false);
  });

  it("rejects a task title longer than 255 characters", () => {
    const result = createTaskSchema.safeParse({ title: "x".repeat(256) });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid task assignee ID", () => {
    const result = createTaskSchema.safeParse({ title: "Test Task", assigneeId: "not-a-uuid" });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid task priority", () => {
    const result = createTaskSchema.safeParse({ title: "Test Task", priority: "CRITICAL" });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid task start date", () => {
    const result = createTaskSchema.safeParse({ title: "Test Task", startDate: "not-a-date" });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid task due date", () => {
    const result = createTaskSchema.safeParse({ title: "Test Task", dueDate: "not-a-date" });

    expect(result.success).toBe(false);
  });

  it("accepts a partial task update", () => {
    const result = updateTaskSchema.safeParse({ title: "Renamed Task" });

    expect(result.success).toBe(true);
  });

  it("allows clearing nullable task fields with null", () => {
    const result = updateTaskSchema.safeParse({ assigneeId: null, description: null });

    expect(result.success).toBe(true);
    expect(result.success && result.data.assigneeId).toBeNull();
  });

  it("rejects an empty task update", () => {
    const result = updateTaskSchema.safeParse({});

    expect(result.success).toBe(false);
  });

  it("rejects an invalid task update priority field", () => {
    const result = updateTaskSchema.safeParse({ priority: "NONE" });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid task update assignee ID", () => {
    const result = updateTaskSchema.safeParse({ assigneeId: "not-a-uuid" });

    expect(result.success).toBe(false);
  });

  it("accepts a valid task status update", () => {
    const result = updateTaskStatusSchema.safeParse({ status: "IN_PROGRESS" });

    expect(result.success).toBe(true);
  });

  it("rejects an invalid task status update", () => {
    const result = updateTaskStatusSchema.safeParse({ status: "ARCHIVED" });

    expect(result.success).toBe(false);
  });

  it("rejects a task status update without a status", () => {
    const result = updateTaskStatusSchema.safeParse({});

    expect(result.success).toBe(false);
  });

  it("applies task list query defaults and accepts filters", () => {
    const result = listTasksQuerySchema.parse({
      status: "IN_PROGRESS",
      assigneeId: "9f3e6b9a-1b9f-4e7a-9f22-5e1b9d6c2a88",
      sort: "dueDate:asc",
    });

    expect(result).toEqual({
      page: 1,
      pageSize: 20,
      status: "IN_PROGRESS",
      assigneeId: "9f3e6b9a-1b9f-4e7a-9f22-5e1b9d6c2a88",
      sort: "dueDate:asc",
    });
  });

  it("rejects an invalid task list status filter", () => {
    const result = listTasksQuerySchema.safeParse({ status: "DRAFT" });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid task list sort", () => {
    const result = listTasksQuerySchema.safeParse({ sort: "priority:desc" });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid task list assignee filter", () => {
    const result = listTasksQuerySchema.safeParse({ assigneeId: "not-a-uuid" });

    expect(result.success).toBe(false);
  });

  it("allows a task transition from TODO to IN_PROGRESS", () => {
    expect(canTransitionTaskStatus("TODO", "IN_PROGRESS")).toBe(true);
  });

  it("allows a task transition from TODO to BLOCKED", () => {
    expect(canTransitionTaskStatus("TODO", "BLOCKED")).toBe(true);
  });

  it("allows task transitions from IN_PROGRESS", () => {
    expect(canTransitionTaskStatus("IN_PROGRESS", "REVIEW")).toBe(true);
    expect(canTransitionTaskStatus("IN_PROGRESS", "BLOCKED")).toBe(true);
  });

  it("allows task transitions from REVIEW", () => {
    expect(canTransitionTaskStatus("REVIEW", "COMPLETED")).toBe(true);
    expect(canTransitionTaskStatus("REVIEW", "IN_PROGRESS")).toBe(true);
    expect(canTransitionTaskStatus("REVIEW", "BLOCKED")).toBe(true);
  });

  it("allows task transitions from BLOCKED", () => {
    expect(canTransitionTaskStatus("BLOCKED", "IN_PROGRESS")).toBe(true);
    expect(canTransitionTaskStatus("BLOCKED", "REVIEW")).toBe(true);
  });

  it("forbids moving a task from COMPLETED", () => {
    expect(canTransitionTaskStatus("COMPLETED", "IN_PROGRESS")).toBe(false);
    expect(canTransitionTaskStatus("COMPLETED", "TODO")).toBe(false);
    expect(canTransitionTaskStatus("COMPLETED", "REVIEW")).toBe(false);
  });

  it("forbids moving a task backwards from IN_PROGRESS to TODO", () => {
    expect(canTransitionTaskStatus("IN_PROGRESS", "TODO")).toBe(false);
  });

  it("forbids skipping task statuses", () => {
    expect(canTransitionTaskStatus("TODO", "REVIEW")).toBe(false);
    expect(canTransitionTaskStatus("TODO", "COMPLETED")).toBe(false);
    expect(canTransitionTaskStatus("IN_PROGRESS", "COMPLETED")).toBe(false);
  });

  it("forbids task self-transitions", () => {
    expect(canTransitionTaskStatus("TODO", "TODO")).toBe(false);
    expect(canTransitionTaskStatus("BLOCKED", "BLOCKED")).toBe(false);
    expect(canTransitionTaskStatus("REVIEW", "REVIEW")).toBe(false);
  });
});
