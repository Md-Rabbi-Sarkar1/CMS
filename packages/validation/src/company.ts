import { z } from "zod";

export const updateCompanySchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(255, "Name must be at most 255 characters").optional(),
    logoUrl: z.string().trim().url("Logo URL must be a valid URL").max(2048, "Logo URL is too long").optional(),
  })
  .strict();

export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;
