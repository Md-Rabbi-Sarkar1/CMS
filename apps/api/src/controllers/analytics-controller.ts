import type { NextFunction, Request, Response } from "express";

import { AnalyticsService } from "../services/analytics-service.js";
import { ValidationError } from "../utils/errors.js";
import { sendSuccess } from "../utils/response.js";

export class AnalyticsController {
  private readonly analyticsService: AnalyticsService;

  constructor(analyticsService: AnalyticsService = new AnalyticsService()) {
    this.analyticsService = analyticsService;
  }

  getDashboard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new ValidationError([{ field: "auth", message: "Authentication required" }]);
      }
      const dashboard = await this.analyticsService.getDashboard(req.user);
      sendSuccess(res, dashboard);
    } catch (error) {
      next(error);
    }
  };

  getProjectProgress = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new ValidationError([{ field: "auth", message: "Authentication required" }]);
      }
      const progress = await this.analyticsService.getProjectProgress(req.user);
      sendSuccess(res, progress);
    } catch (error) {
      next(error);
    }
  };

  getAnalytics = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new ValidationError([{ field: "auth", message: "Authentication required" }]);
      }
      const analytics = await this.analyticsService.getAnalytics(req.user);
      sendSuccess(res, analytics);
    } catch (error) {
      next(error);
    }
  };
}
