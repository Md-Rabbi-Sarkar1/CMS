import { Router } from "express";

import { UserController } from "../controllers/user-controller.js";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/rbac.js";

export const userRouter: Router = Router();

const userController = new UserController();

// Invitation acceptance is public (token-authenticated, not session-authenticated).
userRouter.post("/invitations/accept", (req, res, next) => {
  userController.acceptInvite(req, res, next).catch(next);
});

userRouter.get("/invitations/verify/:token", (req, res, next) => {
  userController.verifyInvite(req, res, next).catch(next);
});

// Authenticated, ADMIN-only management endpoints.
userRouter.post("/invitations", authenticate, authorize("ADMIN"), (req, res, next) => {
  userController.invite(req, res, next).catch(next);
});

userRouter.get("/invitations", authenticate, authorize("ADMIN"), (req, res, next) => {
  userController.listInvitations(req, res, next).catch(next);
});

userRouter.get("/", authenticate, authorize("ADMIN", "PROJECT_MANAGER"), (req, res, next) => {
  userController.listUsers(req, res, next).catch(next);
});

userRouter.patch("/:id", authenticate, authorize("ADMIN"), (req, res, next) => {
  userController.updateUser(req, res, next).catch(next);
});
