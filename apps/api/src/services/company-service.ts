import type { UpdateCompanyInput } from "@construction-ops/validation";

import { CompanyRepository } from "../repositories/company-repository.js";
import { NotFoundError } from "../utils/errors.js";

export interface CompanyResponse {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  contactInfo: string | null;
  address: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface CompanyRecord {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  contactInfo: string | null;
  address: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function toCompanyResponse(company: CompanyRecord): CompanyResponse {
  return {
    id: company.id,
    name: company.name,
    slug: company.slug,
    logoUrl: company.logoUrl,
    contactInfo: company.contactInfo,
    address: company.address,
    createdAt: company.createdAt,
    updatedAt: company.updatedAt,
  };
}

export class CompanyService {
  private readonly companyRepository: CompanyRepository;

  constructor(companyRepository = new CompanyRepository()) {
    this.companyRepository = companyRepository;
  }

  async getCompany(companyId: string): Promise<CompanyResponse> {
    const company = await this.companyRepository.findById(companyId);

    if (!company) {
      throw new NotFoundError("Company not found");
    }

    return toCompanyResponse(company);
  }

  async updateCompany(companyId: string, data: UpdateCompanyInput): Promise<CompanyResponse> {
    const existing = await this.companyRepository.findById(companyId);

    if (!existing) {
      throw new NotFoundError("Company not found");
    }

    const updated = await this.companyRepository.update(companyId, data);
    return toCompanyResponse(updated);
  }
}
