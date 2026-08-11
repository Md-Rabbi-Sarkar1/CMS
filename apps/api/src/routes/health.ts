import { Router } from "express";

import { sendSuccess } from "../utils/response.js";

export const healthRouter: Router = Router();

healthRouter.get("/", (_req, res) => {
  sendSuccess(res, { status: "ok" });
});
