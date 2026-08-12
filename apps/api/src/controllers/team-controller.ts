import type { NextFunction, Request, Response } from "express";

import { z } from "zod";

import { addProjectMemberSchema, listProjectMembersQuerySchema } from "@construction-ops/validation";

import { TeamService } from "../services/team-service.js";
import { NotFoundError, UnauthorizedError, ValidationError } from "../utils/errors.js";
import { sendSuccess } from "../utils/response.js";

const projectIdParamSchema = z.string().uuid("Invalid project ID");
const userIdParamSchema = z.string().uuid("Invalid user ID");

export class TeamController {
  private readonly teamService: TeamService;

  constructor(teamService = new TeamService()) {
    this.teamService = teamService;
  }

  listMembers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError("Not authenticated");
      }

      const projectId = req.params.id;

      if (projectId === undefined) {
        throw new NotFoundError("Project not found");
      }

      const parsed = listProjectMembersQuerySchema.safeParse(req.query);

      if (!parsed.success) {
        throw new ValidationError(
          parsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        );
      }

      const { members, total } = await this.teamService.listMembers(
        req.user.sub,
        req.user.companyId,
        req.user.role,
        projectId,
        parsed.data,
      );

      sendSuccess(res, { members }, 200, {
        page: parsed.data.page,
        pageSize: parsed.data.pageSize,
        total,
      });
    } catch (error) {
      next(error);
    }
  };

  addMember = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError("Not authenticated");
      }

      const projectId = req.params.id;

      if (projectId === undefined) {
        throw new NotFoundError("Project not found");
      }

      const parsed = addProjectMemberSchema.safeParse(req.body);

      if (!parsed.success) {
        throw new ValidationError(
          parsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        );
      }

      const member = await this.teamService.addMember(
        req.user.sub,
        req.user.companyId,
        req.user.role,
        projectId,
        parsed.data.userId,
      );

      sendSuccess(res, member, 201);
    } catch (error) {
      next(error);
    }
  };

  removeMember = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError("Not authenticated");
      }

      const projectId = req.params.id;

      if (projectId === undefined) {
        throw new NotFoundError("Project not found");
      }

      const userId = req.params.userId;

      if (userId === undefined) {
        throw new NotFoundError("Member not found");
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

      const userIdParsed = userIdParamSchema.safeParse(userId);

      if (!userIdParsed.success) {
        throw new ValidationError(
          userIdParsed.error.issues.map((issue) => ({
            field: "userId",
            message: issue.message,
          })),
        );
      }

      await this.teamService.removeMember(req.user.sub, req.user.companyId, req.user.role, projectId, userId);

      res.status(204).end();
    } catch (error) {
      next(error);
    }
  };
}
