import { Router } from "express";

import { DocumentController } from "../controllers/document-controller.js";
import { authenticate } from "../middleware/auth.js";

export const documentRouter: Router = Router();

const documentController = new DocumentController();

documentRouter.post("/", authenticate, (req, res, next) => {
  documentController.create(req, res, next).catch(next);
});

documentRouter.get("/", authenticate, (req, res, next) => {
  documentController.list(req, res, next).catch(next);
});

documentRouter.get("/:id", authenticate, (req, res, next) => {
  documentController.getById(req, res, next).catch(next);
});

documentRouter.delete("/:id", authenticate, (req, res, next) => {
  documentController.remove(req, res, next).catch(next);
});
