import { Router } from "express";

import { ReportController } from "../controllers/report-controller.js";
import { authenticate } from "../middleware/auth.js";

export const reportRouter: Router = Router();

const reportController = new ReportController();

reportRouter.post("/", authenticate, (req, res, next) => {
  reportController.create(req, res, next).catch(next);
});

reportRouter.get("/", authenticate, (req, res, next) => {
  reportController.list(req, res, next).catch(next);
});

reportRouter.get("/:id", authenticate, (req, res, next) => {
  reportController.getById(req, res, next).catch(next);
});

reportRouter.patch("/:id", authenticate, (req, res, next) => {
  reportController.update(req, res, next).catch(next);
});

reportRouter.delete("/:id", authenticate, (req, res, next) => {
  reportController.remove(req, res, next).catch(next);
});
