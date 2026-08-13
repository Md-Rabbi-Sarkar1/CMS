import { Router } from "express";

import { CompanyController } from "../controllers/company-controller.js";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/rbac.js";

export const companyRouter: Router = Router();

const companyController = new CompanyController();

companyRouter.get("/", authenticate, (req, res, next) => {
  companyController.getProfile(req, res, next).catch(next);
});

companyRouter.patch("/", authenticate, authorize("ADMIN"), (req, res, next) => {
  companyController.updateProfile(req, res, next).catch(next);
});
