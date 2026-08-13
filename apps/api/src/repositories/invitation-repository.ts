import type { Prisma, PrismaClient, CompanyRole } from "@construction-ops/database";

import { prisma } from "../providers/database.js";

export interface InvitationRow {
  id: string;
  email: string;
  role: CompanyRole;
  status: string;
  expiresAt: Date;
  createdAt: Date;
  companyId: string;
  tokenHash: string | null;
}

const invitationSelect = {
  id: true,
  email: true,
  role: true,
  status: true,
  expiresAt: true,
  createdAt: true,
  companyId: true,
  tokenHash: true,
} as const satisfies Prisma.InvitationSelect;

export class InvitationRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  list(companyId: string): Promise<InvitationRow[]> {
    return this.client.invitation.findMany({
      where: { companyId },
      select: invitationSelect,
      orderBy: { createdAt: "desc" },
    });
  }

  findPendingByEmail(companyId: string, email: string): Promise<InvitationRow | null> {
    return this.client.invitation.findFirst({
      where: { companyId, email, status: "PENDING" },
      select: invitationSelect,
    });
  }

  findByTokenHash(tokenHash: string): Promise<InvitationRow | null> {
    return this.client.invitation.findFirst({
      where: { tokenHash, status: "PENDING" },
      select: invitationSelect,
    });
  }

  create(data: {
    companyId: string;
    email: string;
    role: CompanyRole;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<InvitationRow> {
    return this.client.invitation.create({
      data: {
        companyId: data.companyId,
        email: data.email,
        role: data.role,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
      },
      select: invitationSelect,
    });
  }

  async markAccepted(id: string): Promise<void> {
    await this.client.invitation.update({
      where: { id },
      data: { status: "ACCEPTED", acceptedAt: new Date() },
    });
  }
}
