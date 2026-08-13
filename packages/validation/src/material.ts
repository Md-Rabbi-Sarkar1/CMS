import { z } from "zod";

import { INVENTORY_TX_TYPES } from "@construction-ops/shared";

import { uuidSchema } from "./common.js";

const inventoryTxTypeSchema = z.enum(INVENTORY_TX_TYPES);

export const createMaterialSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(255, "Name must be at most 255 characters"),
    unit: z.string().trim().min(1, "Unit is required").max(50, "Unit must be at most 50 characters"),
    currentStock: z.coerce.number().nonnegative("Stock must be non-negative").optional(),
    reorderLevel: z.coerce.number().nonnegative("Reorder level must be non-negative").optional(),
  })
  .strict();

export type CreateMaterialInput = z.infer<typeof createMaterialSchema>;

export const updateMaterialSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(255, "Name must be at most 255 characters").optional(),
    unit: z.string().trim().min(1, "Unit is required").max(50, "Unit must be at most 50 characters").optional(),
    reorderLevel: z.coerce.number().nonnegative("Reorder level must be non-negative").optional(),
  })
  .strict();

export type UpdateMaterialInput = z.infer<typeof updateMaterialSchema>;

export const materialIdParamsSchema = z.object({
  id: uuidSchema,
});

export const materialListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    lowStock: z.coerce.boolean().optional(),
  })
  .strict();

export type MaterialListQuery = z.infer<typeof materialListQuerySchema>;

export const inventoryTxSchema = z
  .object({
    type: inventoryTxTypeSchema,
    quantity: z.coerce.number().positive("Quantity must be positive"),
    projectId: uuidSchema.optional(),
    note: z.string().max(2000, "Note must be at most 2000 characters").optional(),
  })
  .strict();

export type InventoryTxInput = z.infer<typeof inventoryTxSchema>;
