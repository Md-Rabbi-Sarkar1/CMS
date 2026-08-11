import { Router } from "express";

import { ProjectController } from "../controllers/project-controller.js";
import { authenticate } from "../middleware/auth.js";

export const projectsRouter: Router = Router();

const projectController = new ProjectController();

projectsRouter.get("/", authenticate, (req, res, next) => {
  projectController.list(req, res, next).catch(next);
});

projectsRouter.post("/", authenticate, (req, res, next) => {
  projectController.create(req, res, next).catch(next);
});

projectsRouter.get("/:id", authenticate, (req, res, next) => {
  projectController.get(req, res, next).catch(next);
});

projectsRouter.patch("/:id", authenticate, (req, res, next) => {
  projectController.update(req, res, next).catch(next);
});

projectsRouter.patch("/:id/status", authenticate, (req, res, next) => {
  projectController.updateStatus(req, res, next).catch(next);
});

projectsRouter.patch("/:id/progress", authenticate, (req, res, next) => {
  projectController.updateProgress(req, res, next).catch(next);
});
