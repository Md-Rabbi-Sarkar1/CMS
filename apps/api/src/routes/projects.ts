import { Router } from "express";

import { ProjectController } from "../controllers/project-controller.js";
import { TaskController } from "../controllers/task-controller.js";
import { TeamController } from "../controllers/team-controller.js";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/rbac.js";

export const projectRouter: Router = Router();

const projectController = new ProjectController();
const teamController = new TeamController();
const taskController = new TaskController();

projectRouter.post("/", authenticate, authorize("ADMIN", "PROJECT_MANAGER"), (req, res, next) => {
  projectController.create(req, res, next).catch(next);
});

projectRouter.get("/", authenticate, (req, res, next) => {
  projectController.list(req, res, next).catch(next);
});

projectRouter.get("/:id", authenticate, (req, res, next) => {
  projectController.getById(req, res, next).catch(next);
});

projectRouter.patch("/:id", authenticate, authorize("ADMIN", "PROJECT_MANAGER"), (req, res, next) => {
  projectController.update(req, res, next).catch(next);
});

projectRouter.delete("/:id", authenticate, authorize("ADMIN"), (req, res, next) => {
  projectController.remove(req, res, next).catch(next);
});

// Project team (members).
projectRouter.get("/:id/members", authenticate, (req, res, next) => {
  teamController.listMembers(req, res, next).catch(next);
});

projectRouter.post("/:id/members", authenticate, authorize("ADMIN", "PROJECT_MANAGER"), (req, res, next) => {
  teamController.addMember(req, res, next).catch(next);
});

projectRouter.delete("/:id/members/:userId", authenticate, authorize("ADMIN", "PROJECT_MANAGER"), (req, res, next) => {
  teamController.removeMember(req, res, next).catch(next);
});

// Project tasks.
projectRouter.get("/:id/tasks", authenticate, (req, res, next) => {
  taskController.listByProject(req, res, next).catch(next);
});

projectRouter.post("/:id/tasks", authenticate, authorize("ADMIN", "PROJECT_MANAGER", "ENGINEER"), (req, res, next) => {
  taskController.create(req, res, next).catch(next);
});
