import { Router } from "express";

import { MaterialController } from "../controllers/material-controller.js";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/rbac.js";

export const materialRouter: Router = Router();

const materialController = new MaterialController();

materialRouter.post("/", authenticate, authorize("ADMIN", "PROJECT_MANAGER", "ENGINEER"), (req, res, next) => {
  materialController.create(req, res, next).catch(next);
});

materialRouter.get("/", authenticate, (req, res, next) => {
  materialController.list(req, res, next).catch(next);
});

materialRouter.get("/:id", authenticate, (req, res, next) => {
  materialController.getById(req, res, next).catch(next);
});

materialRouter.patch("/:id", authenticate, authorize("ADMIN", "PROJECT_MANAGER", "ENGINEER"), (req, res, next) => {
  materialController.update(req, res, next).catch(next);
});

materialRouter.delete("/:id", authenticate, authorize("ADMIN", "PROJECT_MANAGER"), (req, res, next) => {
  materialController.remove(req, res, next).catch(next);
});

materialRouter.post("/:id/transactions", authenticate, authorize("ADMIN", "PROJECT_MANAGER", "ENGINEER"), (req, res, next) => {
  materialController.recordTransaction(req, res, next).catch(next);
});

materialRouter.get("/:id/transactions", authenticate, (req, res, next) => {
  materialController.listTransactions(req, res, next).catch(next);
});
