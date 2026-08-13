import type { NextFunction, Request, Response } from "express";

import {
  createDocumentSchema,
  documentIdParamsSchema,
  documentListQuerySchema,
} from "@construction-ops/validation";

import { DocumentService } from "../services/document-service.js";
import { ValidationError } from "../utils/errors.js";
import { sendSuccess } from "../utils/response.js";

export class DocumentController {
  private readonly documentService: DocumentService;

  constructor(documentService: DocumentService = new DocumentService()) {
    this.documentService = documentService;
  }

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new ValidationError([{ field: "auth", message: "Authentication required" }]);
      }

      const parsed = createDocumentSchema.safeParse(req.body);

      if (!parsed.success) {
        throw new ValidationError(
          parsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        );
      }

      const doc = await this.documentService.create(req.user, parsed.data);
      sendSuccess(res, doc, 201);
    } catch (error) {
      next(error);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new ValidationError([{ field: "auth", message: "Authentication required" }]);
      }

      const parsed = documentListQuerySchema.safeParse(req.query);

      if (!parsed.success) {
        throw new ValidationError(
          parsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        );
      }

      const result = await this.documentService.list(req.user, parsed.data);
      sendSuccess(res, result.items, 200, result.page, result.pageSize, result.total);
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new ValidationError([{ field: "auth", message: "Authentication required" }]);
      }

      const parsed = documentIdParamsSchema.safeParse(req.params);

      if (!parsed.success) {
        throw new ValidationError(
          parsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        );
      }

      const doc = await this.documentService.getById(req.user, parsed.data.id);
      sendSuccess(res, doc);
    } catch (error) {
      next(error);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new ValidationError([{ field: "auth", message: "Authentication required" }]);
      }

      const parsed = documentIdParamsSchema.safeParse(req.params);

      if (!parsed.success) {
        throw new ValidationError(
          parsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        );
      }

      await this.documentService.delete(req.user, parsed.data.id);
      sendSuccess(res, { message: "Document deleted" });
    } catch (error) {
      next(error);
    }
  };
}
