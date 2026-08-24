import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express } from "express";

import { env } from "./config/env.js";
import { errorHandler } from "./middleware/error-handler.js";
import { authRateLimit, globalRateLimit } from "./middleware/rate-limit.js";
import { securityHeaders } from "./middleware/security-headers.js";
import { analyticsRouter } from "./routes/analytics.js";
import { authRouter } from "./routes/auth.js";
import { companyRouter } from "./routes/company.js";
import { documentRouter } from "./routes/documents.js";
import { expenseRouter } from "./routes/expenses.js";
import { healthRouter } from "./routes/health.js";
import { issueRouter } from "./routes/issues.js";
import { materialRouter } from "./routes/materials.js";
import { notificationRouter } from "./routes/notifications.js";
import { projectRouter } from "./routes/projects.js";
import { reportRouter } from "./routes/reports.js";
import { taskRouter } from "./routes/tasks.js";
import { userRouter } from "./routes/users.js";
import { NotFoundError } from "./utils/errors.js";

export const app: Express = express();

app.disable("x-powered-by");
app.use(securityHeaders);
app.use(cors({ origin: env.WEB_URL, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(globalRateLimit);

app.use("/api/v1/health", healthRouter);
app.use("/api/v1/auth", authRateLimit, authRouter);
app.use("/api/v1/company", companyRouter);
app.use("/api/v1/users", userRouter);
app.use("/api/v1/projects", projectRouter);
app.use("/api/v1/tasks", taskRouter);
app.use("/api/v1/reports", reportRouter);
app.use("/api/v1/materials", materialRouter);
app.use("/api/v1/expenses", expenseRouter);
app.use("/api/v1/issues", issueRouter);
app.use("/api/v1/documents", documentRouter);
app.use("/api/v1/notifications", notificationRouter);
app.use("/api/v1/analytics", analyticsRouter);

app.use((_req, _res, next) => {
  next(new NotFoundError("Route not found"));
});

app.use(errorHandler);
