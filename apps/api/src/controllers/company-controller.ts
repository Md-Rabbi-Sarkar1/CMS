import type { NextFunction, Request, Response } from "express";

import { updateCompanySchema } from "@construction-ops/validation";

import { CompanyService } from "../services/company-service.js";
import { UnauthorizedError, ValidationError } from "../utils/errors.js";
import { sendSuccess } from "../utils/response.js";

export class CompanyController {
  private readonly companyService: CompanyService;

  constructor(companyService = new CompanyService()) {
    this.companyService = companyService;
  }

  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError("Not authenticated");
      }

      const company = await this.companyService.getCompany(req.user.companyId);
      sendSuccess(res, company);
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError("Not authenticated");
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

      if (Object.keys(parsed.data).length === 0) {
        throw new ValidationError([{ field: "body", message: "At least one field must be provided" }]);
      }

      const company = await this.companyService.updateCompany(req.user.companyId, parsed.data);
      sendSuccess(res, company);
    } catch (error) {
      next(error);
    }
  };
}
