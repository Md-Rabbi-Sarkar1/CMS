import type { Prisma } from "@construction-ops/database";

import { prisma } from "../providers/database.js";
import { NotFoundError } from "../utils/errors.js";
import type { JWTPayload } from "../types/auth.js";

export function accessibleProjectWhere(user: JWTPayload): Prisma.ProjectWhereInput {
  if (user.role === "ADMIN") return { companyId: user.companyId };

  return {
    companyId: user.companyId,
    OR: [{ managerId: user.sub }, { members: { some: { userId: user.sub } } }],
  };
}

export async function assertProjectAccess(user: JWTPayload, projectId: string): Promise<void> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, ...accessibleProjectWhere(user) },
    select: { id: true },
  });

  if (!project) throw new NotFoundError("Project not found");
}

export async function accessibleProjectIds(user: JWTPayload): Promise<string[]> {
  const projects = await prisma.project.findMany({
    where: accessibleProjectWhere(user),
    select: { id: true },
  });
  return projects.map((project) => project.id);
}
