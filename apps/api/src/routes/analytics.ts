import { Router } from "express";

import { AnalyticsController } from "../controllers/analytics-controller.js";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/rbac.js";

export const analyticsRouter: Router = Router();

const analyticsController = new AnalyticsController();

analyticsRouter.get("/dashboard", authenticate, authorize("ADMIN", "PROJECT_MANAGER"), (req, res, next) => {
  analyticsController.getDashboard(req, res, next).catch(next);
});

analyticsRouter.get("/project-progress", authenticate, authorize("ADMIN", "PROJECT_MANAGER"), (req, res, next) => {
  analyticsController.getProjectProgress(req, res, next).catch(next);
});

analyticsRouter.get("/", authenticate, authorize("ADMIN", "PROJECT_MANAGER"), (req, res, next) => {
  analyticsController.getAnalytics(req, res, next).catch(next);
});
