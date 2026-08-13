import type { NextFunction, Request, Response } from "express";

import {
  createTaskSchema,
  projectIdParamsSchema,
  taskIdParamsSchema,
  taskListQuerySchema,
  taskStatusTransitionSchema,
  updateTaskSchema,
} from "@construction-ops/validation";

import { TaskService } from "../services/task-service.js";
import { ValidationError } from "../utils/errors.js";
import { sendSuccess } from "../utils/response.js";

export class TaskController {
  private readonly taskService: TaskService;

  constructor(taskService: TaskService = new TaskService()) {
    this.taskService = taskService;
  }

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new ValidationError([{ field: "auth", message: "Authentication required" }]);
      }

      const paramsParsed = projectIdParamsSchema.safeParse(req.params);

      if (!paramsParsed.success) {
        throw new ValidationError(
          paramsParsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        );
      }

      const bodyParsed = createTaskSchema.safeParse(req.body);

      if (!bodyParsed.success) {
        throw new ValidationError(
          bodyParsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        );
      }

      const task = await this.taskService.create(req.user, paramsParsed.data.id, bodyParsed.data);
      sendSuccess(res, task, 201);
    } catch (error) {
      next(error);
    }
  };

  listByProject = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new ValidationError([{ field: "auth", message: "Authentication required" }]);
      }

      const paramsParsed = projectIdParamsSchema.safeParse(req.params);

      if (!paramsParsed.success) {
        throw new ValidationError(
          paramsParsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        );
      }

      const queryParsed = taskListQuerySchema.safeParse(req.query);

      if (!queryParsed.success) {
        throw new ValidationError(
          queryParsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        );
      }

      const result = await this.taskService.list(req.user, paramsParsed.data.id, queryParsed.data);
      sendSuccess(res, result.items, 200, result.page, result.pageSize, result.total);
    } catch (error) {
      next(error);
    }
  };

  listAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new ValidationError([{ field: "auth", message: "Authentication required" }]);
      }

      const queryParsed = taskListQuerySchema.safeParse(req.query);

      if (!queryParsed.success) {
        throw new ValidationError(
          queryParsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        );
      }

      const result = await this.taskService.list(req.user, undefined, queryParsed.data);
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

      const parsed = taskIdParamsSchema.safeParse(req.params);

      if (!parsed.success) {
        throw new ValidationError(
          parsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        );
      }

      const task = await this.taskService.getById(req.user, parsed.data.id);
      sendSuccess(res, task);
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new ValidationError([{ field: "auth", message: "Authentication required" }]);
      }

      const paramsParsed = taskIdParamsSchema.safeParse(req.params);

      if (!paramsParsed.success) {
        throw new ValidationError(
          paramsParsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        );
      }

      const bodyParsed = updateTaskSchema.safeParse(req.body);

      if (!bodyParsed.success) {
        throw new ValidationError(
          bodyParsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        );
      }

      const task = await this.taskService.update(req.user, paramsParsed.data.id, bodyParsed.data);
      sendSuccess(res, task);
    } catch (error) {
      next(error);
    }
  };

  transitionStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new ValidationError([{ field: "auth", message: "Authentication required" }]);
      }

      const paramsParsed = taskIdParamsSchema.safeParse(req.params);

      if (!paramsParsed.success) {
        throw new ValidationError(
          paramsParsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        );
      }

      const bodyParsed = taskStatusTransitionSchema.safeParse(req.body);

      if (!bodyParsed.success) {
        throw new ValidationError(
          bodyParsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        );
      }

      const task = await this.taskService.transitionStatus(req.user, paramsParsed.data.id, bodyParsed.data.status);
      sendSuccess(res, task);
    } catch (error) {
      next(error);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new ValidationError([{ field: "auth", message: "Authentication required" }]);
      }

      const parsed = taskIdParamsSchema.safeParse(req.params);

      if (!parsed.success) {
        throw new ValidationError(
          parsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        );
      }

      await this.taskService.delete(req.user, parsed.data.id);
      sendSuccess(res, { message: "Task deleted" });
    } catch (error) {
      next(error);
    }
  };
}
