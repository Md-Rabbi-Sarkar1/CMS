import type { CompanyRole } from "@construction-ops/validation";

import { prisma } from "../providers/database.js";

export type InvitationStatus = "PENDING" | "ACCEPTED" | "EXPIRED" | "REVOKED";

export interface CreateInvitationData {
  companyId: string;
  email: string;
  role: CompanyRole;
  tokenHash: string;
  expiresAt: Date;
}

export class InvitationRepository {
  create(data: CreateInvitationData) {
    return prisma.invitation.create({
      data,
    });
  }

  findByTokenHash(tokenHash: string) {
    return prisma.invitation.findFirst({
      where: { tokenHash },
    });
  }

  findPendingByEmail(email: string, companyId: string) {
    return prisma.invitation.findFirst({
      where: { email, companyId, status: "PENDING" },
      select: { id: true },
    });
  }

  updateStatus(id: string, status: InvitationStatus) {
    return prisma.invitation.update({
      where: { id },
      data: { status },
    });
  }

  markAccepted(id: string) {
    return prisma.invitation.update({
      where: { id },
      data: {
        status: "ACCEPTED",
        acceptedAt: new Date(),
      },
    });
  }
}
