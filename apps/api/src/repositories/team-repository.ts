import type { Prisma, PrismaClient } from "@construction-ops/database";

import { prisma } from "../providers/database.js";

export type MemberRow = Prisma.ProjectMemberGetPayload<{
  include: { user: { select: { id: true; name: true; email: true; role: true } } };
}>;

const memberInclude = {
  user: { select: { id: true, name: true, email: true, role: true } },
} satisfies Prisma.ProjectMemberInclude;

export class TeamRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  listByProject(projectId: string): Promise<MemberRow[]> {
    return this.client.projectMember.findMany({
      where: { projectId },
      include: memberInclude,
      orderBy: { assignedAt: "asc" },
    });
  }

  findMembership(projectId: string, userId: string) {
    return this.client.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
  }

  addMember(projectId: string, userId: string): Promise<MemberRow> {
    return this.client.projectMember.create({
      data: { projectId, userId },
      include: memberInclude,
    });
  }

  removeMember(projectId: string, userId: string): Promise<void> {
    return this.client.projectMember
      .delete({ where: { projectId_userId: { projectId, userId } } })
      .then(() => undefined);
  }
}

export const teamIncludeFields = memberInclude;
