import type { UpdateCompanyInput } from "@construction-ops/validation";

import { CompanyRepository, type CompanyProfile } from "../repositories/company-repository.js";
import { NotFoundError } from "../utils/errors.js";
import type { JWTPayload } from "../types/auth.js";

export type CompanyResponse = CompanyProfile;

export class CompanyService {
  private readonly companyRepository: CompanyRepository;

  constructor(companyRepository: CompanyRepository = new CompanyRepository()) {
    this.companyRepository = companyRepository;
  }

  async getProfile(user: JWTPayload): Promise<CompanyResponse> {
    const company = await this.companyRepository.findById(user.companyId);

    if (!company) {
      throw new NotFoundError("Company not found");
    }

    return company;
  }

  async updateProfile(user: JWTPayload, payload: UpdateCompanyInput): Promise<CompanyResponse> {
    const company = await this.companyRepository.findById(user.companyId);

    if (!company) {
      throw new NotFoundError("Company not found");
    }

    const data: { name?: string; logoUrl?: string | null } = {};
    if (payload.name !== undefined) {
      data.name = payload.name;
    }
    if (payload.logoUrl !== undefined) {
      data.logoUrl = payload.logoUrl;
    }

    return this.companyRepository.update(user.companyId, data);
  }
}
