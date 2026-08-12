import { Router } from "express";

import { TaskController } from "../controllers/task-controller.js";
import { authenticate } from "../middleware/auth.js";

export const tasksRouter: Router = Router();

const taskController = new TaskController();

tasksRouter.get("/tasks", authenticate, (req, res, next) => {
  taskController.list(req, res, next).catch(next);
});

tasksRouter.post("/tasks", authenticate, (req, res, next) => {
  taskController.create(req, res, next).catch(next);
});

tasksRouter.get("/tasks/:id", authenticate, (req, res, next) => {
  taskController.get(req, res, next).catch(next);
});

tasksRouter.patch("/tasks/:id", authenticate, (req, res, next) => {
  taskController.update(req, res, next).catch(next);
});

tasksRouter.patch("/tasks/:id/status", authenticate, (req, res, next) => {
  taskController.updateStatus(req, res, next).catch(next);
});

tasksRouter.get("/projects/:id/tasks", authenticate, (req, res, next) => {
  taskController.listProjectTasks(req, res, next).catch(next);
});

tasksRouter.post("/projects/:id/tasks", authenticate, (req, res, next) => {
  taskController.createProjectTask(req, res, next).catch(next);
});
