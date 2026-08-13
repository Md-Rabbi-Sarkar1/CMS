import type { Prisma, PrismaClient, ExpenseCategory, ExpenseStatus } from "@construction-ops/database";

import { prisma } from "../providers/database.js";

export interface ExpenseListFilters {
  companyId: string;
  page: number;
  pageSize: number;
  projectId?: string | undefined;
  status?: ExpenseStatus | undefined;
  category?: ExpenseCategory | undefined;
}

export interface ExpenseListResult {
  items: ExpenseRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateExpenseData {
  projectId: string;
  submittedById: string;
  category: ExpenseCategory;
  amount: number;
  description: string;
  expenseDate: Date;
}

export interface ReviewExpenseData {
  status: ExpenseStatus;
  reviewedById: string;
  rejectionReason?: string;
}

export type ExpenseRow = Prisma.ExpenseGetPayload<{
  include: {
    project: { select: { id: true; name: true } };
    submittedBy: { select: { id: true; name: true; email: true } };
    reviewedBy: { select: { id: true; name: true; email: true } };
  };
}>;

const expenseInclude = {
  project: { select: { id: true, name: true } },
  submittedBy: { select: { id: true, name: true, email: true } },
  reviewedBy: { select: { id: true, name: true, email: true } },
} satisfies Prisma.ExpenseInclude;

export class ExpenseRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  async list(filters: ExpenseListFilters): Promise<ExpenseListResult> {
    const where: Prisma.ExpenseWhereInput = { project: { companyId: filters.companyId } };
    if (filters.projectId !== undefined) where.projectId = filters.projectId;
    if (filters.status !== undefined) where.status = filters.status;
    if (filters.category !== undefined) where.category = filters.category;

    const [items, total] = await this.client.$transaction([
      this.client.expense.findMany({
        where,
        include: expenseInclude,
        orderBy: { expenseDate: "desc" },
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
      }),
      this.client.expense.count({ where }),
    ]);

    return { items, total, page: filters.page, pageSize: filters.pageSize };
  }

  findOwnedById(id: string, companyId: string): Promise<ExpenseRow | null> {
    return this.client.expense.findFirst({
      where: { id, project: { companyId } },
      include: expenseInclude,
    });
  }

  create(data: CreateExpenseData): Promise<ExpenseRow> {
    const createData: Prisma.ExpenseCreateInput = {
      project: { connect: { id: data.projectId } },
      submittedBy: { connect: { id: data.submittedById } },
      category: data.category,
      amount: data.amount,
      description: data.description,
      expenseDate: data.expenseDate,
    };

    return this.client.expense.create({ data: createData, include: expenseInclude });
  }

  review(id: string, data: ReviewExpenseData): Promise<ExpenseRow> {
    const updateData: Prisma.ExpenseUpdateInput = {
      status: data.status,
      reviewedBy: { connect: { id: data.reviewedById } },
      reviewedAt: new Date(),
    };
    if (data.rejectionReason !== undefined) updateData.rejectionReason = data.rejectionReason;

    return this.client.expense.update({ where: { id }, data: updateData, include: expenseInclude });
  }

  delete(id: string): Promise<void> {
    return this.client.expense.delete({ where: { id } }).then(() => undefined);
  }
}
