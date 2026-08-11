import { Router } from "express";

import { UserController } from "../controllers/user-controller.js";
import { authenticate } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/rbac.js";

export const usersRouter: Router = Router();

const userController = new UserController();

usersRouter.get("/", authenticate, requireAdmin, (req, res, next) => {
  userController.list(req, res, next).catch(next);
});

usersRouter.post("/invite", authenticate, requireAdmin, (req, res, next) => {
  userController.invite(req, res, next).catch(next);
});

usersRouter.patch("/:id", authenticate, requireAdmin, (req, res, next) => {
  userController.update(req, res, next).catch(next);
});
