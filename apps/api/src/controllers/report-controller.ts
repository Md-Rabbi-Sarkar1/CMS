import type { NextFunction, Request, Response } from "express";

import {
  createDailyWorkReportSchema,
  reportIdParamsSchema,
  reportListQuerySchema,
  updateDailyWorkReportSchema,
} from "@construction-ops/validation";

import { ReportService } from "../services/report-service.js";
import { ValidationError } from "../utils/errors.js";
import { sendSuccess } from "../utils/response.js";

export class ReportController {
  private readonly reportService: ReportService;

  constructor(reportService: ReportService = new ReportService()) {
    this.reportService = reportService;
  }

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new ValidationError([{ field: "auth", message: "Authentication required" }]);
      }

      const parsed = createDailyWorkReportSchema.safeParse(req.body);

      if (!parsed.success) {
        throw new ValidationError(
          parsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        );
      }

      const report = await this.reportService.create(req.user, parsed.data);
      sendSuccess(res, report, 201);
    } catch (error) {
      next(error);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new ValidationError([{ field: "auth", message: "Authentication required" }]);
      }

      const parsed = reportListQuerySchema.safeParse(req.query);

      if (!parsed.success) {
        throw new ValidationError(
          parsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        );
      }

      const result = await this.reportService.list(req.user, parsed.data);
      sendSuccess(res, result.items, 200, result.page, result.pageSize, result.total);
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new ValidationError([{ field: "auth", message: "Authentication required" }]);
      }

      const parsed = reportIdParamsSchema.safeParse(req.params);

      if (!parsed.success) {
        throw new ValidationError(
          parsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        );
      }

      const report = await this.reportService.getById(req.user, parsed.data.id);
      sendSuccess(res, report);
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new ValidationError([{ field: "auth", message: "Authentication required" }]);
      }

      const paramsParsed = reportIdParamsSchema.safeParse(req.params);

      if (!paramsParsed.success) {
        throw new ValidationError(
          paramsParsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        );
      }

      const bodyParsed = updateDailyWorkReportSchema.safeParse(req.body);

      if (!bodyParsed.success) {
        throw new ValidationError(
          bodyParsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        );
      }

      const report = await this.reportService.update(req.user, paramsParsed.data.id, bodyParsed.data);
      sendSuccess(res, report);
    } catch (error) {
      next(error);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new ValidationError([{ field: "auth", message: "Authentication required" }]);
      }

      const parsed = reportIdParamsSchema.safeParse(req.params);

      if (!parsed.success) {
        throw new ValidationError(
          parsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        );
      }

      await this.reportService.delete(req.user, parsed.data.id);
      sendSuccess(res, { message: "Daily work report deleted" });
    } catch (error) {
      next(error);
    }
  };
}
