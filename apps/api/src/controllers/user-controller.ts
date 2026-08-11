import type { NextFunction, Request, Response } from "express";

import { createInvitationSchema, listUsersQuerySchema, updateUserSchema } from "@construction-ops/validation";

import { UserService } from "../services/user-service.js";
import { NotFoundError, UnauthorizedError, ValidationError } from "../utils/errors.js";
import { sendSuccess } from "../utils/response.js";

export class UserController {
  private readonly userService: UserService;

  constructor(userService = new UserService()) {
    this.userService = userService;
  }

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError("Not authenticated");
      }

      const parsed = listUsersQuerySchema.safeParse(req.query);

      if (!parsed.success) {
        throw new ValidationError(
          parsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        );
      }

      const { users, total } = await this.userService.listUsers(req.user.companyId, parsed.data);
      sendSuccess(res, { users }, 200, {
        page: parsed.data.page,
        pageSize: parsed.data.pageSize,
        total,
      });
    } catch (error) {
      next(error);
    }
  };

  invite = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError("Not authenticated");
      }

      const parsed = createInvitationSchema.safeParse(req.body);

      if (!parsed.success) {
        throw new ValidationError(
          parsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        );
      }

      const invitation = await this.userService.inviteUser(req.user.companyId, parsed.data);
      sendSuccess(res, invitation, 201);
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError("Not authenticated");
      }

      const parsed = updateUserSchema.safeParse(req.body);

      if (!parsed.success) {
        throw new ValidationError(
          parsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        );
      }

      if (Object.keys(parsed.data).length === 0) {
        throw new ValidationError([{ field: "body", message: "At least one field must be provided" }]);
      }

      const userId = req.params.id;

      if (userId === undefined) {
        throw new NotFoundError("User not found");
      }

      const user = await this.userService.updateUser(req.user.companyId, userId, parsed.data);
      sendSuccess(res, user);
    } catch (error) {
      next(error);
    }
  };
}
