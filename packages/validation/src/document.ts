import { z } from "zod";

import { uuidSchema } from "./common.js";

export const createDocumentSchema = z
  .object({
    projectId: uuidSchema,
    name: z.string().trim().min(1, "Name is required").max(255, "Name must be at most 255 characters"),
    type: z.string().trim().min(1, "Type is required").max(100, "Type must be at most 100 characters"),
    mimeType: z.string().trim().min(1, "Mime type is required").max(255, "Mime type must be at most 255 characters"),
    sizeBytes: z.number().int().nonnegative("Size must be non-negative"),
    storageKey: z.string().max(2048, "Storage key is too long").optional(),
  })
  .strict();

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;

export const documentIdParamsSchema = z.object({
  id: uuidSchema,
});

export const documentListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    projectId: uuidSchema.optional(),
  })
  .strict();

export type DocumentListQuery = z.infer<typeof documentListQuerySchema>;
