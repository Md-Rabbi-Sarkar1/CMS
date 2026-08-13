import { Router } from "express";

import { NotificationController } from "../controllers/notification-controller.js";
import { authenticate } from "../middleware/auth.js";

export const notificationRouter: Router = Router();

const notificationController = new NotificationController();

notificationRouter.get("/", authenticate, (req, res, next) => {
  notificationController.list(req, res, next).catch(next);
});

notificationRouter.get("/unread-count", authenticate, (req, res, next) => {
  notificationController.unreadCount(req, res, next).catch(next);
});

notificationRouter.post("/mark-all-read", authenticate, (req, res, next) => {
  notificationController.markAllAsRead(req, res, next).catch(next);
});

notificationRouter.post("/:id/read", authenticate, (req, res, next) => {
  notificationController.markAsRead(req, res, next).catch(next);
});
