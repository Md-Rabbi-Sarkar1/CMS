import { Router } from "express";

import { ExpenseController } from "../controllers/expense-controller.js";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/rbac.js";

export const expenseRouter: Router = Router();

const expenseController = new ExpenseController();

expenseRouter.post("/", authenticate, (req, res, next) => {
  expenseController.create(req, res, next).catch(next);
});

expenseRouter.get("/", authenticate, (req, res, next) => {
  expenseController.list(req, res, next).catch(next);
});

expenseRouter.get("/:id", authenticate, (req, res, next) => {
  expenseController.getById(req, res, next).catch(next);
});

expenseRouter.patch("/:id/review", authenticate, authorize("ADMIN", "PROJECT_MANAGER"), (req, res, next) => {
  expenseController.review(req, res, next).catch(next);
});

expenseRouter.delete("/:id", authenticate, (req, res, next) => {
  expenseController.remove(req, res, next).catch(next);
});
