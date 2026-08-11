import { Router } from "express";

import { AuthController } from "../controllers/auth-controller.js";
import { authenticate } from "../middleware/auth.js";

export const authRouter: Router = Router();

const authController = new AuthController();

authRouter.post("/login", (req, res, next) => {
  authController.login(req, res, next).catch(next);
});

authRouter.post("/refresh", (req, res, next) => {
  authController.refresh(req, res, next).catch(next);
});

authRouter.post("/logout", (req, res, next) => {
  authController.logout(req, res, next).catch(next);
});

authRouter.get("/me", authenticate, (req, res, next) => {
  authController.me(req, res, next).catch(next);
});
