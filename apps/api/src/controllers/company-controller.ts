import type { NextFunction, Request, Response } from "express";

import { updateCompanySchema } from "@construction-ops/validation";

import { CompanyService } from "../services/company-service.js";
import { ValidationError } from "../utils/errors.js";
import { sendSuccess } from "../utils/response.js";

export class CompanyController {
  private readonly companyService: CompanyService;

  constructor(companyService: CompanyService = new CompanyService()) {
    this.companyService = companyService;
  }

  getProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new ValidationError([{ field: "auth", message: "Authentication required" }]);
      }
      const company = await this.companyService.getProfile(req.user);
      sendSuccess(res, company);
    } catch (error) {
      next(error);
    }
  };

  updateProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new ValidationError([{ field: "auth", message: "Authentication required" }]);
      }

      const parsed = updateCompanySchema.safeParse(req.body);

      if (!parsed.success) {
        throw new ValidationError(
          parsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        );
      }

      const company = await this.companyService.updateProfile(req.user, parsed.data);
      sendSuccess(res, company);
    } catch (error) {
      next(error);
    }
  };
}
