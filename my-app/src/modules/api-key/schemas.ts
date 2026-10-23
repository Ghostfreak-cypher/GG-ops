import { z } from "zod";
import { API_KEY_SCOPES } from "@/models/ApiKey";

export const createApiKeySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(60),
  scopes: z.array(z.enum(API_KEY_SCOPES)).min(1, "Pick at least one scope").default(["read"]),
  expiresInDays: z.coerce.number().int().min(1).max(365).optional(),
});

export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
