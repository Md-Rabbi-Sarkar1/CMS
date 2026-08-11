import type { NextFunction, Request, Response } from "express";

import {
  createProjectSchema,
  listProjectsQuerySchema,
  updateProjectProgressSchema,
  updateProjectSchema,
  updateProjectStatusSchema,
} from "@construction-ops/validation";

import { ProjectService } from "../services/project-service.js";
import { NotFoundError, UnauthorizedError, ValidationError } from "../utils/errors.js";
import { sendSuccess } from "../utils/response.js";

export class ProjectController {
  private readonly projectService: ProjectService;

  constructor(projectService = new ProjectService()) {
    this.projectService = projectService;
  }

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError("Not authenticated");
      }

      const parsed = listProjectsQuerySchema.safeParse(req.query);

      if (!parsed.success) {
        throw new ValidationError(
          parsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        );
      }

      const { projects, total } = await this.projectService.listProjects(
        req.user.sub,
        req.user.companyId,
        req.user.role,
        parsed.data,
      );

      sendSuccess(res, { projects }, 200, {
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

      const projectId = req.params.id;

      if (projectId === undefined) {
        throw new NotFoundError("Project not found");
      }

      const project = await this.projectService.getProject(req.user.sub, req.user.companyId, req.user.role, projectId);
      sendSuccess(res, project);
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError("Not authenticated");
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

      const project = await this.projectService.createProject(
        req.user.sub,
        req.user.companyId,
        req.user.role,
        parsed.data,
      );

      sendSuccess(res, project, 201);
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError("Not authenticated");
      }

      const projectId = req.params.id;

      if (projectId === undefined) {
        throw new NotFoundError("Project not found");
      }

      const parsed = updateProjectSchema.safeParse(req.body);

      if (!parsed.success) {
        throw new ValidationError(
          parsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        );
      }

      const project = await this.projectService.updateProject(
        req.user.sub,
        req.user.companyId,
        req.user.role,
        projectId,
        parsed.data,
      );

      sendSuccess(res, project);
    } catch (error) {
      next(error);
    }
  };

  updateStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError("Not authenticated");
      }

      const projectId = req.params.id;

      if (projectId === undefined) {
        throw new NotFoundError("Project not found");
      }

      const parsed = updateProjectStatusSchema.safeParse(req.body);

      if (!parsed.success) {
        throw new ValidationError(
          parsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        );
      }

      const project = await this.projectService.changeProjectStatus(
        req.user.sub,
        req.user.companyId,
        req.user.role,
        projectId,
        parsed.data,
      );

      sendSuccess(res, project);
    } catch (error) {
      next(error);
    }
  };

  updateProgress = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError("Not authenticated");
      }

      const projectId = req.params.id;

      if (projectId === undefined) {
        throw new NotFoundError("Project not found");
      }

      const parsed = updateProjectProgressSchema.safeParse(req.body);

      if (!parsed.success) {
        throw new ValidationError(
          parsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        );
      }

      const project = await this.projectService.updateProjectProgress(
        req.user.sub,
        req.user.companyId,
        req.user.role,
        projectId,
        parsed.data,
      );

      sendSuccess(res, project);
    } catch (error) {
      next(error);
    }
  };
}
