import type { CompanyRole, ListUsersQuery, UpdateUserInput } from "@construction-ops/validation";

import { prisma } from "../providers/database.js";

export interface UserListItem {
  id: string;
  name: string;
  email: string;
  role: CompanyRole;
  status: "ACTIVE" | "INACTIVE";
  companyId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserListResult {
  users: UserListItem[];
  total: number;
}

export interface CreateUserData {
  companyId: string;
  name: string;
  email: string;
  passwordHash: string;
  role: CompanyRole;
}

const USER_LIST_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  companyId: true,
  createdAt: true,
  updatedAt: true,
} as const;

export class UserRepository {
  findByEmail(email: string) {
    return prisma.user.findFirst({
      where: { email },
    });
  }

  findByEmailInCompany(email: string, companyId: string) {
    return prisma.user.findFirst({
      where: { email, companyId },
      select: { id: true },
    });
  }

  findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
    });
  }

  findByIdInCompany(id: string, companyId: string) {
    return prisma.user.findFirst({
      where: { id, companyId },
      select: USER_LIST_SELECT,
    });
  }

  findByIdWithCompany(id: string) {
    return prisma.user.findUnique({
      where: { id },
      include: {
        company: true,
      },
    });
  }

  create(data: CreateUserData) {
    return prisma.user.create({
      data,
    });
  }

  async list(companyId: string, query: ListUsersQuery): Promise<UserListResult> {
    const where = {
      companyId,
      ...(query.search !== undefined
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" as const } },
              { email: { contains: query.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(query.role !== undefined ? { role: query.role } : {}),
      ...(query.status !== undefined ? { status: query.status } : {}),
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: USER_LIST_SELECT,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.user.count({ where }),
    ]);

    return { users, total };
  }

  updateRoleStatus(id: string, companyId: string, data: UpdateUserInput): Promise<number> {
    return prisma.user
      .updateMany({
        where: { id, companyId },
        data: {
          ...(data.role !== undefined ? { role: data.role } : {}),
          ...(data.status !== undefined ? { status: data.status } : {}),
        },
      })
      .then((result) => result.count);
  }
}
