import { Router } from "express";

import { TaskController } from "../controllers/task-controller.js";
import { authenticate } from "../middleware/auth.js";

export const taskRouter: Router = Router();

const taskController = new TaskController();

// Company-wide task list (scoped by role in the service).
taskRouter.get("/", authenticate, (req, res, next) => {
  taskController.listAll(req, res, next).catch(next);
});

taskRouter.get("/:id", authenticate, (req, res, next) => {
  taskController.getById(req, res, next).catch(next);
});

taskRouter.patch("/:id", authenticate, (req, res, next) => {
  taskController.update(req, res, next).catch(next);
});

taskRouter.patch("/:id/status", authenticate, (req, res, next) => {
  taskController.transitionStatus(req, res, next).catch(next);
});

taskRouter.delete("/:id", authenticate, (req, res, next) => {
  taskController.remove(req, res, next).catch(next);
});
