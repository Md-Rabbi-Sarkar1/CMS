import { prisma } from "../providers/database.js";

export class UserRepository {
  findByEmail(email: string) {
    return prisma.user.findFirst({
      where: { email },
    });
  }

  findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
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
}
