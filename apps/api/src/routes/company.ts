import { Router } from "express";

import { CompanyController } from "../controllers/company-controller.js";
import { authenticate } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/rbac.js";

export const companyRouter: Router = Router();

const companyController = new CompanyController();

companyRouter.get("/", authenticate, (req, res, next) => {
  companyController.get(req, res, next).catch(next);
});

companyRouter.patch("/", authenticate, requireAdmin, (req, res, next) => {
  companyController.update(req, res, next).catch(next);
});
