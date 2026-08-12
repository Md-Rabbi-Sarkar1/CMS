import type { NextFunction, Request, Response } from "express";

import { z } from "zod";

import { AnalyticsService } from "../services/analytics-service.js";
import { NotFoundError, UnauthorizedError, ValidationError } from "../utils/errors.js";
import { sendSuccess } from "../utils/response.js";

const projectIdParamSchema = z.string().uuid("Invalid project ID");

export class AnalyticsController {
  private readonly analyticsService: AnalyticsService;

  constructor(analyticsService = new AnalyticsService()) {
    this.analyticsService = analyticsService;
  }

  getCompanyDashboard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError("Not authenticated");
      }

      const dashboard = await this.analyticsService.getCompanyDashboard(
        req.user.sub,
        req.user.companyId,
        req.user.role,
      );

      sendSuccess(res, dashboard);
    } catch (error) {
      next(error);
    }
  };

  getProjectDashboard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError("Not authenticated");
      }

      const projectId = req.params.id;

      if (projectId === undefined) {
        throw new NotFoundError("Project not found");
      }

      const parsed = projectIdParamSchema.safeParse(projectId);

      if (!parsed.success) {
        throw new ValidationError(
          parsed.error.issues.map((issue) => ({
            field: "id",
            message: issue.message,
          })),
        );
      }

      const dashboard = await this.analyticsService.getProjectDashboard(
        req.user.sub,
        req.user.companyId,
        req.user.role,
        projectId,
      );

      sendSuccess(res, dashboard);
    } catch (error) {
      next(error);
    }
  };
}
