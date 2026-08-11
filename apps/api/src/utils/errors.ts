export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: { field: string; message: string }[];

  constructor(
    message: string,
    statusCode = 500,
    code = "INTERNAL_ERROR",
    details?: { field: string; message: string }[],
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    if (details !== undefined) {
      this.details = details;
    }
  }
}

export class ValidationError extends AppError {
  constructor(details?: { field: string; message: string }[]) {
    super("Invalid input", 400, "VALIDATION_ERROR", details);
    this.name = "ValidationError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, 401, "UNAUTHORIZED");
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(message, 403, "FORBIDDEN");
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, 404, "NOT_FOUND");
    this.name = "NotFoundError";
  }
}
