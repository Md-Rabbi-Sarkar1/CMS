import type {
  CreateExpenseInput,
  ExpenseReviewInput,
} from "@construction-ops/validation";
import type { ExpenseCategory, ExpenseStatus } from "@construction-ops/database";

import {
  ExpenseRepository,
  type ExpenseListFilters,
  type ExpenseRow,
  type CreateExpenseData,
  type ReviewExpenseData,
} from "../repositories/expense-repository.js";
import { NotificationEventService } from "./notification-event-service.js";
import { ConflictError, ForbiddenError, NotFoundError } from "../utils/errors.js";
import type { JWTPayload } from "../types/auth.js";

export interface ExpenseResponse {
  id: string;
  projectId: string | null;
  submittedById: string;
  reviewedById: string | null;
  category: string;
  amount: string;
  description: string;
  expenseDate: string;
  status: string;
  rejectionReason: string | null;
  reviewedAt: string | null;
  project: { id: string; name: string } | null;
  submittedBy: { id: string; name: string; email: string };
  reviewedBy: { id: string; name: string; email: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseListResponse {
  items: ExpenseResponse[];
  total: number;
  page: number;
  pageSize: number;
}

function toResponse(expense: ExpenseRow): ExpenseResponse {
  return {
    id: expense.id,
    projectId: expense.projectId,
    submittedById: expense.submittedById,
    reviewedById: expense.reviewedById,
    category: expense.category,
    amount: expense.amount.toString(),
    description: expense.description,
    expenseDate: expense.expenseDate.toISOString().slice(0, 10),
    status: expense.status,
    rejectionReason: expense.rejectionReason,
    reviewedAt: expense.reviewedAt ? expense.reviewedAt.toISOString() : null,
    project: { id: expense.project.id, name: expense.project.name },
    submittedBy: {
      id: expense.submittedBy.id,
      name: expense.submittedBy.name,
      email: expense.submittedBy.email,
    },
    reviewedBy: expense.reviewedBy
      ? { id: expense.reviewedBy.id, name: expense.reviewedBy.name, email: expense.reviewedBy.email }
      : null,
    createdAt: expense.createdAt.toISOString(),
    updatedAt: expense.updatedAt.toISOString(),
  };
}

export class ExpenseService {
  private readonly expenseRepository: ExpenseRepository;
  private readonly notificationEvents: NotificationEventService;

  constructor(
    expenseRepository: ExpenseRepository = new ExpenseRepository(),
    notificationEvents: NotificationEventService = new NotificationEventService(),
  ) {
    this.expenseRepository = expenseRepository;
    this.notificationEvents = notificationEvents;
  }

  async create(user: JWTPayload, payload: CreateExpenseInput): Promise<ExpenseResponse> {
    const data: CreateExpenseData = {
      projectId: payload.projectId,
      submittedById: user.sub,
      category: payload.category,
      amount: payload.amount,
      description: payload.description,
      expenseDate: new Date(payload.expenseDate),
    };

    const expense = await this.expenseRepository.create(data);

    await this.notificationEvents.expensePending({
      companyId: user.companyId,
      projectId: expense.projectId,
      actorId: user.sub,
      projectName: expense.project.name,
      submitterName: expense.submittedBy.name,
      category: expense.category,
      amount: expense.amount.toString(),
    });

    return toResponse(expense);
  }

  async list(
    user: JWTPayload,
    query: {
      page: number;
      pageSize: number;
      projectId?: string | undefined;
      status?: ExpenseStatus | undefined;
      category?: ExpenseCategory | undefined;
    },
  ): Promise<ExpenseListResponse> {
    const filters: ExpenseListFilters = {
      companyId: user.companyId,
      page: query.page,
      pageSize: query.pageSize,
    };
    if (query.projectId !== undefined) filters.projectId = query.projectId;
    if (query.status !== undefined) filters.status = query.status;
    if (query.category !== undefined) filters.category = query.category;

    const result = await this.expenseRepository.list(filters);
    return {
      items: result.items.map(toResponse),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    };
  }

  async getById(user: JWTPayload, id: string): Promise<ExpenseResponse> {
    const expense = await this.expenseRepository.findOwnedById(id, user.companyId);
    if (!expense) {
      throw new NotFoundError("Expense not found");
    }
    return toResponse(expense);
  }

  async review(
    user: JWTPayload,
    id: string,
    payload: ExpenseReviewInput,
  ): Promise<ExpenseResponse> {
    if (user.role !== "ADMIN" && user.role !== "PROJECT_MANAGER") {
      throw new ForbiddenError("Only managers can review expenses");
    }

    const expense = await this.expenseRepository.findOwnedById(id, user.companyId);
    if (!expense) {
      throw new NotFoundError("Expense not found");
    }

    if (expense.status !== "PENDING") {
      throw new ConflictError("Expense has already been reviewed");
    }

    const data: ReviewExpenseData = {
      status: payload.status,
      reviewedById: user.sub,
    };
    if (payload.rejectionReason !== undefined) data.rejectionReason = payload.rejectionReason;

    const reviewed = await this.expenseRepository.review(id, data);
    return toResponse(reviewed);
  }

  async delete(user: JWTPayload, id: string): Promise<void> {
    const expense = await this.expenseRepository.findOwnedById(id, user.companyId);
    if (!expense) {
      throw new NotFoundError("Expense not found");
    }

    if (user.role !== "ADMIN" && expense.submittedById !== user.sub) {
      throw new ForbiddenError("You can only delete your own expenses");
    }

    await this.expenseRepository.delete(id);
  }
}
