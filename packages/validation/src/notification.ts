import { z } from "zod";

import { uuidSchema } from "./common.js";

export const notificationIdParamsSchema = z.object({
  id: uuidSchema,
});

export const notificationListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    unreadOnly: z.coerce.boolean().optional(),
  })
  .strict();

export type NotificationListQuery = z.infer<typeof notificationListQuerySchema>;
