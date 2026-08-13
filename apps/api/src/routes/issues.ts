import { Router } from "express";

import { IssueController } from "../controllers/issue-controller.js";
import { authenticate } from "../middleware/auth.js";

export const issueRouter: Router = Router();

const issueController = new IssueController();

issueRouter.post("/", authenticate, (req, res, next) => {
  issueController.create(req, res, next).catch(next);
});

issueRouter.get("/", authenticate, (req, res, next) => {
  issueController.list(req, res, next).catch(next);
});

issueRouter.get("/:id", authenticate, (req, res, next) => {
  issueController.getById(req, res, next).catch(next);
});

issueRouter.patch("/:id", authenticate, (req, res, next) => {
  issueController.update(req, res, next).catch(next);
});

issueRouter.delete("/:id", authenticate, (req, res, next) => {
  issueController.remove(req, res, next).catch(next);
});
