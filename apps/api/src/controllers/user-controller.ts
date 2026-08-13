import type { NextFunction, Request, Response } from "express";

import {
  acceptInviteSchema,
  inviteUserSchema,
  updateUserSchema,
  userIdParamsSchema,
  userListQuerySchema,
} from "@construction-ops/validation";

import { UserService } from "../services/user-service.js";
import { hashInviteToken } from "../utils/invitation-token.js";
import { NotFoundError, ValidationError } from "../utils/errors.js";
import { sendSuccess } from "../utils/response.js";
import { createAccessToken } from "../utils/jwt.js";
import { generateRefreshToken, hashRefreshToken } from "../utils/refresh-token.js";
import { prisma } from "../providers/database.js";
import { setAuthCookies } from "../utils/cookies.js";

const REFRESH_TOKEN_EXPIRY_DAYS = 7;

export class UserController {
  private readonly userService: UserService;

  constructor(userService: UserService = new UserService()) {
    this.userService = userService;
  }

  invite = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new ValidationError([{ field: "auth", message: "Authentication required" }]);
      }

      const parsed = inviteUserSchema.safeParse(req.body);

      if (!parsed.success) {
        throw new ValidationError(
          parsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        );
      }

      const result = await this.userService.invite(req.user, parsed.data);
      sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  };

  listInvitations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new ValidationError([{ field: "auth", message: "Authentication required" }]);
      }
      const invitations = await this.userService.listInvitations(req.user);
      sendSuccess(res, invitations);
    } catch (error) {
      next(error);
    }
  };

  listUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new ValidationError([{ field: "auth", message: "Authentication required" }]);
      }

      const parsed = userListQuerySchema.safeParse(req.query);

      if (!parsed.success) {
        throw new ValidationError(
          parsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        );
      }

      const result = await this.userService.listUsers(req.user, parsed.data);
      sendSuccess(res, result.items, 200, result.page, result.pageSize, result.total);
    } catch (error) {
      next(error);
    }
  };

  updateUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new ValidationError([{ field: "auth", message: "Authentication required" }]);
      }

      const paramsParsed = userIdParamsSchema.safeParse(req.params);

      if (!paramsParsed.success) {
        throw new ValidationError(
          paramsParsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        );
      }

      const bodyParsed = updateUserSchema.safeParse(req.body);

      if (!bodyParsed.success) {
        throw new ValidationError(
          bodyParsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        );
      }

      const user = await this.userService.updateUserRole(req.user, paramsParsed.data.id, bodyParsed.data);
      sendSuccess(res, user);
    } catch (error) {
      next(error);
    }
  };

  acceptInvite = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = acceptInviteSchema.safeParse(req.body);

      if (!parsed.success) {
        throw new ValidationError(
          parsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        );
      }

      const result = await this.userService.acceptInvite(parsed.data);

      // Issue session cookies so the new user is immediately authenticated.
      const createdUser = await prisma.user.findUnique({
        where: { id: result.userId },
        select: { id: true, companyId: true, role: true },
      });

      if (!createdUser) {
        throw new NotFoundError("User not found");
      }

      const accessToken = createAccessToken({
        sub: createdUser.id,
        companyId: createdUser.companyId,
        role: createdUser.role,
      });

      const refreshToken = generateRefreshToken();
      const refreshTokenHash = hashRefreshToken(refreshToken);
      const refreshTokenExpiresAt = new Date();
      refreshTokenExpiresAt.setDate(refreshTokenExpiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

      await prisma.refreshToken.create({
        data: {
          user: { connect: { id: result.userId } },
          tokenHash: refreshTokenHash,
          expiresAt: refreshTokenExpiresAt,
        },
      });

      setAuthCookies(res, accessToken, refreshToken);
      sendSuccess(res, { message: "Invitation accepted", userId: result.userId });
    } catch (error) {
      next(error);
    }
  };

  verifyInvite = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { token } = req.params;
      if (typeof token !== "string" || token.length === 0) {
        throw new NotFoundError("Invitation not found");
      }

      const tokenHash = hashInviteToken(token);
      const invitation = await prisma.invitation.findFirst({
        where: { tokenHash, status: "PENDING" },
        select: { email: true, role: true, expiresAt: true, companyId: true },
      });

      if (!invitation) {
        throw new NotFoundError("Invitation not found or already used");
      }

      if (invitation.expiresAt < new Date()) {
        throw new NotFoundError("Invitation has expired");
      }

      sendSuccess(res, {
        email: invitation.email,
        role: invitation.role,
        valid: true,
      });
    } catch (error) {
      next(error);
    }
  };
}
