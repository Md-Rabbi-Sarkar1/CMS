import { prisma } from "../providers/database.js";

export interface CreateRefreshTokenData {
  user: { connect: { id: string } };
  tokenHash: string;
  expiresAt: Date;
}

export class RefreshTokenRepository {
  create(data: CreateRefreshTokenData) {
    return prisma.refreshToken.create({
      data,
    });
  }

  findByTokenHash(tokenHash: string) {
    return prisma.refreshToken.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
    });
  }

  revokeById(id: string) {
    return prisma.refreshToken.update({
      where: { id },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  revokeByUserId(userId: string): Promise<number> {
    return prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    }).then((result) => result.count);
  }

  async replaceToken(oldTokenId: string, newTokenHash: string, expiresAt: Date) {
    const oldToken = await prisma.refreshToken.findUnique({
      where: { id: oldTokenId },
      select: { userId: true },
    });

    if (!oldToken) {
      throw new Error("Old refresh token not found");
    }

    await prisma.refreshToken.update({
      where: { id: oldTokenId },
      data: {
        replacedAt: new Date(),
        revokedAt: new Date(),
      },
    });

    return prisma.refreshToken.create({
      data: {
        user: {
          connect: { id: oldToken.userId },
        },
        tokenHash: newTokenHash,
        expiresAt,
      },
    });
  }
}
