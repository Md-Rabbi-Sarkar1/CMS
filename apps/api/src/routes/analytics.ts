import { Router } from "express";

import { AnalyticsController } from "../controllers/analytics-controller.js";
import { authenticate } from "../middleware/auth.js";

export const analyticsRouter: Router = Router();

const analyticsController = new AnalyticsController();

analyticsRouter.get("/analytics/company", authenticate, (req, res, next) => {
  analyticsController.getCompanyDashboard(req, res, next).catch(next);
});

analyticsRouter.get("/analytics/projects/:id", authenticate, (req, res, next) => {
  analyticsController.getProjectDashboard(req, res, next).catch(next);
});
