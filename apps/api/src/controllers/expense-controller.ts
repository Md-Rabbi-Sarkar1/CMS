import type { NextFunction, Request, Response } from "express";

import {
  createExpenseSchema,
  expenseIdParamsSchema,
  expenseListQuerySchema,
  expenseReviewSchema,
} from "@construction-ops/validation";

import { ExpenseService } from "../services/expense-service.js";
import { ValidationError } from "../utils/errors.js";
import { sendSuccess } from "../utils/response.js";

export class ExpenseController {
  private readonly expenseService: ExpenseService;

  constructor(expenseService: ExpenseService = new ExpenseService()) {
    this.expenseService = expenseService;
  }

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new ValidationError([{ field: "auth", message: "Authentication required" }]);
      }

      const parsed = createExpenseSchema.safeParse(req.body);

      if (!parsed.success) {
        throw new ValidationError(
          parsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        );
      }

      const expense = await this.expenseService.create(req.user, parsed.data);
      sendSuccess(res, expense, 201);
    } catch (error) {
      next(error);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new ValidationError([{ field: "auth", message: "Authentication required" }]);
      }

      const parsed = expenseListQuerySchema.safeParse(req.query);

      if (!parsed.success) {
        throw new ValidationError(
          parsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        );
      }

      const result = await this.expenseService.list(req.user, parsed.data);
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

      const parsed = expenseIdParamsSchema.safeParse(req.params);

      if (!parsed.success) {
        throw new ValidationError(
          parsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        );
      }

      const expense = await this.expenseService.getById(req.user, parsed.data.id);
      sendSuccess(res, expense);
    } catch (error) {
      next(error);
    }
  };

  review = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new ValidationError([{ field: "auth", message: "Authentication required" }]);
      }

      const paramsParsed = expenseIdParamsSchema.safeParse(req.params);

      if (!paramsParsed.success) {
        throw new ValidationError(
          paramsParsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        );
      }

      const bodyParsed = expenseReviewSchema.safeParse(req.body);

      if (!bodyParsed.success) {
        throw new ValidationError(
          bodyParsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        );
      }

      const expense = await this.expenseService.review(req.user, paramsParsed.data.id, bodyParsed.data);
      sendSuccess(res, expense);
    } catch (error) {
      next(error);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new ValidationError([{ field: "auth", message: "Authentication required" }]);
      }

      const parsed = expenseIdParamsSchema.safeParse(req.params);

      if (!parsed.success) {
        throw new ValidationError(
          parsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        );
      }

      await this.expenseService.delete(req.user, parsed.data.id);
      sendSuccess(res, { message: "Expense deleted" });
    } catch (error) {
      next(error);
    }
  };
}
