import { Router } from "express";

import { TeamController } from "../controllers/team-controller.js";
import { authenticate } from "../middleware/auth.js";

export const teamRouter: Router = Router();

const teamController = new TeamController();

teamRouter.get("/:id/members", authenticate, (req, res, next) => {
  teamController.listMembers(req, res, next).catch(next);
});

teamRouter.post("/:id/members", authenticate, (req, res, next) => {
  teamController.addMember(req, res, next).catch(next);
});

teamRouter.delete("/:id/members/:userId", authenticate, (req, res, next) => {
  teamController.removeMember(req, res, next).catch(next);
});
