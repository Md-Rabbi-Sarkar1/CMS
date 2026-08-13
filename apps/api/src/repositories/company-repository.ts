import type { PrismaClient } from "@construction-ops/database";

import { prisma } from "../providers/database.js";

export interface CompanyProfile {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
}

export interface UpdateCompanyData {
  name?: string;
  logoUrl?: string | null;
}

export class CompanyRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  findById(id: string): Promise<CompanyProfile | null> {
    return this.client.company.findUnique({
      where: { id },
      select: { id: true, name: true, slug: true, logoUrl: true },
    });
  }

  update(id: string, data: UpdateCompanyData): Promise<CompanyProfile> {
    return this.client.company.update({
      where: { id },
      data,
      select: { id: true, name: true, slug: true, logoUrl: true },
    });
  }
}
