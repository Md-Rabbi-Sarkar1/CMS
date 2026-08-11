import type { NextFunction, Request, Response } from "express";

import { acceptInvitationSchema, loginSchema } from "@construction-ops/validation";

import { AuthService } from "../services/auth-service.js";
import { ValidationError, UnauthorizedError } from "../utils/errors.js";
import { sendSuccess } from "../utils/response.js";
import { clearAuthCookies, setAuthCookies } from "../utils/cookies.js";

export class AuthController {
  private readonly authService: AuthService;

  constructor(authService = new AuthService()) {
    this.authService = authService;
  }

  acceptInvite = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = acceptInvitationSchema.safeParse(req.body);

      if (!parsed.success) {
        throw new ValidationError(
          parsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        );
      }

      const result = await this.authService.acceptInvitation(parsed.data.token, parsed.data.password);
      setAuthCookies(res, result.accessToken, result.refreshToken);
      sendSuccess(res, result.user);
    } catch (error) {
      next(error);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = loginSchema.safeParse(req.body);

      if (!parsed.success) {
        throw new ValidationError(
          parsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        );
      }

      const result = await this.authService.login(parsed.data.email, parsed.data.password);
      setAuthCookies(res, result.accessToken, result.refreshToken);
      sendSuccess(res, result.user);
    } catch (error) {
      next(error);
    }
  };

  refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const refreshToken = req.cookies as unknown as { refresh_token?: unknown } | undefined;

      if (typeof refreshToken?.refresh_token !== "string") {
        throw new UnauthorizedError("Refresh token required");
      }

      const result = await this.authService.refresh(refreshToken.refresh_token);
      setAuthCookies(res, result.accessToken, result.refreshToken);
      sendSuccess(res, result.user);
    } catch (error) {
      next(error);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const refreshToken = req.cookies as unknown as { refresh_token?: unknown } | undefined;

      if (typeof refreshToken?.refresh_token === "string") {
        await this.authService.logout(refreshToken.refresh_token);
      }

      clearAuthCookies(res);
      sendSuccess(res, { message: "Logged out successfully" });
    } catch (error) {
      next(error);
    }
  };

  me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError("Not authenticated");
      }

      const user = await this.authService.me(req.user.sub);
      sendSuccess(res, user);
    } catch (error) {
      next(error);
    }
  };
}
