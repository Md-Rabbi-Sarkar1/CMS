import type { NextFunction, Request, Response } from "express";

import {
  createProjectSchema,
  projectIdParamsSchema,
  projectListQuerySchema,
  updateProjectSchema,
} from "@construction-ops/validation";

import { ProjectService } from "../services/project-service.js";
import { ValidationError } from "../utils/errors.js";
import { sendSuccess } from "../utils/response.js";

export class ProjectController {
  private readonly projectService: ProjectService;

  constructor(projectService: ProjectService = new ProjectService()) {
    this.projectService = projectService;
  }

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new ValidationError([{ field: "auth", message: "Authentication required" }]);
      }

      const parsed = createProjectSchema.safeParse(req.body);

      if (!parsed.success) {
        throw new ValidationError(
          parsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        );
      }

      const project = await this.projectService.create(req.user, parsed.data);
      sendSuccess(res, project, 201);
    } catch (error) {
      next(error);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new ValidationError([{ field: "auth", message: "Authentication required" }]);
      }

      const parsed = projectListQuerySchema.safeParse(req.query);

      if (!parsed.success) {
        throw new ValidationError(
          parsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        );
      }

      const result = await this.projectService.list(req.user, parsed.data);
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

      const parsed = projectIdParamsSchema.safeParse(req.params);

      if (!parsed.success) {
        throw new ValidationError(
          parsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        );
      }

      const project = await this.projectService.getById(req.user, parsed.data.id);
      sendSuccess(res, project);
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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

      const bodyParsed = updateProjectSchema.safeParse(req.body);

      if (!bodyParsed.success) {
        throw new ValidationError(
          bodyParsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        );
      }

      const project = await this.projectService.update(req.user, paramsParsed.data.id, bodyParsed.data);
      sendSuccess(res, project);
    } catch (error) {
      next(error);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new ValidationError([{ field: "auth", message: "Authentication required" }]);
      }

      const parsed = projectIdParamsSchema.safeParse(req.params);

      if (!parsed.success) {
        throw new ValidationError(
          parsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        );
      }

      await this.projectService.delete(req.user, parsed.data.id);
      sendSuccess(res, { message: "Project deleted" });
    } catch (error) {
      next(error);
    }
  };
}
