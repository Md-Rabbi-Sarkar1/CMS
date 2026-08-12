import type { NextFunction, Request, Response } from "express";

import { z } from "zod";

import {
  createTaskSchema,
  listTasksQuerySchema,
  updateTaskSchema,
  updateTaskStatusSchema,
} from "@construction-ops/validation";

import { TaskService } from "../services/task-service.js";
import { NotFoundError, UnauthorizedError, ValidationError } from "../utils/errors.js";
import { sendSuccess } from "../utils/response.js";

const taskIdParamSchema = z.string().uuid("Invalid task ID");
const projectIdParamSchema = z.string().uuid("Invalid project ID");

export class TaskController {
  private readonly taskService: TaskService;

  constructor(taskService = new TaskService()) {
    this.taskService = taskService;
  }

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError("Not authenticated");
      }

      const parsed = listTasksQuerySchema.safeParse(req.query);

      if (!parsed.success) {
        throw new ValidationError(
          parsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        );
      }

      const { tasks, total } = await this.taskService.listTasks(
        req.user.sub,
        req.user.companyId,
        req.user.role,
        parsed.data,
      );

      sendSuccess(res, { tasks }, 200, {
        page: parsed.data.page,
        pageSize: parsed.data.pageSize,
        total,
      });
    } catch (error) {
      next(error);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError("Not authenticated");
      }

      const taskId = req.params.id;

      if (taskId === undefined) {
        throw new NotFoundError("Task not found");
      }

      const parsed = taskIdParamSchema.safeParse(taskId);

      if (!parsed.success) {
        throw new ValidationError(
          parsed.error.issues.map((issue) => ({
            field: "id",
            message: issue.message,
          })),
        );
      }

      const task = await this.taskService.getTask(req.user.sub, req.user.companyId, req.user.role, taskId);
      sendSuccess(res, task);
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError("Not authenticated");
      }

      const bodyProjectId = (req.body as Record<string, unknown> | undefined)?.projectId;

      if (typeof bodyProjectId !== "string") {
        throw new ValidationError([{ field: "projectId", message: "Invalid project ID" }]);
      }

      const projectIdParsed = projectIdParamSchema.safeParse(bodyProjectId);

      if (!projectIdParsed.success) {
        throw new ValidationError(
          projectIdParsed.error.issues.map((issue) => ({
            field: "projectId",
            message: issue.message,
          })),
        );
      }

      const parsed = createTaskSchema.safeParse(req.body);

      if (!parsed.success) {
        throw new ValidationError(
          parsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        );
      }

      const task = await this.taskService.createTask(
        req.user.sub,
        req.user.companyId,
        req.user.role,
        projectIdParsed.data,
        parsed.data,
      );

      sendSuccess(res, task, 201);
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError("Not authenticated");
      }

      const taskId = req.params.id;

      if (taskId === undefined) {
        throw new NotFoundError("Task not found");
      }

      const taskIdParsed = taskIdParamSchema.safeParse(taskId);

      if (!taskIdParsed.success) {
        throw new ValidationError(
          taskIdParsed.error.issues.map((issue) => ({
            field: "id",
            message: issue.message,
          })),
        );
      }

      const parsed = updateTaskSchema.safeParse(req.body);

      if (!parsed.success) {
        throw new ValidationError(
          parsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        );
      }

      const task = await this.taskService.updateTask(
        req.user.sub,
        req.user.companyId,
        req.user.role,
        taskId,
        parsed.data,
      );

      sendSuccess(res, task);
    } catch (error) {
      next(error);
    }
  };

  updateStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError("Not authenticated");
      }

      const taskId = req.params.id;

      if (taskId === undefined) {
        throw new NotFoundError("Task not found");
      }

      const taskIdParsed = taskIdParamSchema.safeParse(taskId);

      if (!taskIdParsed.success) {
        throw new ValidationError(
          taskIdParsed.error.issues.map((issue) => ({
            field: "id",
            message: issue.message,
          })),
        );
      }

      const parsed = updateTaskStatusSchema.safeParse(req.body);

      if (!parsed.success) {
        throw new ValidationError(
          parsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        );
      }

      const task = await this.taskService.updateTaskStatus(
        req.user.sub,
        req.user.companyId,
        req.user.role,
        taskId,
        parsed.data.status,
      );

      sendSuccess(res, task);
    } catch (error) {
      next(error);
    }
  };

  listProjectTasks = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError("Not authenticated");
      }

      const projectId = req.params.id;

      if (projectId === undefined) {
        throw new NotFoundError("Project not found");
      }

      const projectIdParsed = projectIdParamSchema.safeParse(projectId);

      if (!projectIdParsed.success) {
        throw new ValidationError(
          projectIdParsed.error.issues.map((issue) => ({
            field: "id",
            message: issue.message,
          })),
        );
      }

      const parsed = listTasksQuerySchema.safeParse(req.query);

      if (!parsed.success) {
        throw new ValidationError(
          parsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        );
      }

      const { tasks, total } = await this.taskService.listProjectTasks(
        req.user.sub,
        req.user.companyId,
        req.user.role,
        projectId,
        parsed.data,
      );

      sendSuccess(res, { tasks }, 200, {
        page: parsed.data.page,
        pageSize: parsed.data.pageSize,
        total,
      });
    } catch (error) {
      next(error);
    }
  };

  createProjectTask = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError("Not authenticated");
      }

      const projectId = req.params.id;

      if (projectId === undefined) {
        throw new NotFoundError("Project not found");
      }

      const projectIdParsed = projectIdParamSchema.safeParse(projectId);

      if (!projectIdParsed.success) {
        throw new ValidationError(
          projectIdParsed.error.issues.map((issue) => ({
            field: "id",
            message: issue.message,
          })),
        );
      }

      const parsed = createTaskSchema.safeParse(req.body);

      if (!parsed.success) {
        throw new ValidationError(
          parsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        );
      }

      const task = await this.taskService.createTask(
        req.user.sub,
        req.user.companyId,
        req.user.role,
        projectId,
        parsed.data,
      );

      sendSuccess(res, task, 201);
    } catch (error) {
      next(error);
    }
  };
}
