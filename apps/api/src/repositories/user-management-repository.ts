import type { Prisma, PrismaClient, CompanyRole } from "@construction-ops/database";

import { prisma } from "../providers/database.js";

export interface UserListFilters {
  companyId: string;
  page: number;
  pageSize: number;
  role?: CompanyRole | undefined;
}

export interface UserListResult {
  items: UserRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  companyId: string;
  createdAt: Date;
}

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  companyId: true,
  createdAt: true,
} as const satisfies Prisma.UserSelect;

export class UserManagementRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  async list(filters: UserListFilters): Promise<UserListResult> {
    const where: Prisma.UserWhereInput = { companyId: filters.companyId };
    if (filters.role !== undefined) {
      where.role = filters.role;
    }

    const [items, total] = await this.client.$transaction([
      this.client.user.findMany({
        where,
        select: userSelect,
        orderBy: { createdAt: "asc" },
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
      }),
      this.client.user.count({ where }),
    ]);

    return { items, total, page: filters.page, pageSize: filters.pageSize };
  }

  findById(id: string, companyId: string) {
    return this.client.user.findFirst({
      where: { id, companyId },
      select: userSelect,
    });
  }

  updateRole(id: string, role: CompanyRole): Promise<UserRow> {
    return this.client.user.update({
      where: { id },
      data: { role },
      select: userSelect,
    });
  }
}
