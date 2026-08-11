import type { UpdateCompanyInput } from "@construction-ops/validation";

import { prisma } from "../providers/database.js";

export class CompanyRepository {
  findById(id: string) {
    return prisma.company.findUnique({
      where: { id },
    });
  }

  update(id: string, data: UpdateCompanyInput) {
    return prisma.company.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.logoUrl !== undefined ? { logoUrl: data.logoUrl } : {}),
        ...(data.contactInfo !== undefined ? { contactInfo: data.contactInfo } : {}),
        ...(data.address !== undefined ? { address: data.address } : {}),
      },
    });
  }
}
