import { Router } from "express";

import { AnalyticsController } from "../controllers/analytics-controller.js";
import { authenticate } from "../middleware/auth.js";

export const analyticsRouter: Router = Router();

const analyticsController = new AnalyticsController();

analyticsRouter.get("/dashboard", authenticate, (req, res, next) => {
  analyticsController.getDashboard(req, res, next).catch(next);
});

analyticsRouter.get("/project-progress", authenticate, (req, res, next) => {
  analyticsController.getProjectProgress(req, res, next).catch(next);
});

analyticsRouter.get("/", authenticate, (req, res, next) => {
  analyticsController.getAnalytics(req, res, next).catch(next);
});
