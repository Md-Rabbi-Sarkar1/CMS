import type { NextFunction, Request, Response } from "express";

import { projectIdParamsSchema } from "@construction-ops/validation";
import { uuidSchema } from "@construction-ops/validation";

import { TeamService } from "../services/team-service.js";
import { ValidationError } from "../utils/errors.js";
import { sendSuccess } from "../utils/response.js";

export class TeamController {
  private readonly teamService: TeamService;

  constructor(teamService: TeamService = new TeamService()) {
    this.teamService = teamService;
  }

  listMembers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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

      const members = await this.teamService.listMembers(req.user, parsed.data.id);
      sendSuccess(res, members);
    } catch (error) {
      next(error);
    }
  };

  addMember = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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

      const body = req.body as Record<string, unknown> | undefined;
      const bodyParsed = uuidSchema.safeParse(body?.userId);

      if (!bodyParsed.success) {
        throw new ValidationError([{ field: "userId", message: "User id must be a valid UUID" }]);
      }

      const member = await this.teamService.addMember(req.user, paramsParsed.data.id, bodyParsed.data);
      sendSuccess(res, member, 201);
    } catch (error) {
      next(error);
    }
  };

  removeMember = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new ValidationError([{ field: "auth", message: "Authentication required" }]);
      }

      const projectId = uuidSchema.safeParse(req.params.id);
      const userId = uuidSchema.safeParse(req.params.userId);

      if (!projectId.success) {
        throw new ValidationError(
          projectId.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        );
      }

      if (!userId.success) {
        throw new ValidationError(
          userId.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        );
      }

      await this.teamService.removeMember(req.user, projectId.data, userId.data);
      sendSuccess(res, { message: "Member removed" });
    } catch (error) {
      next(error);
    }
  };
}
