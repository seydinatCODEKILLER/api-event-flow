import { z } from "zod";

const uuidSchema = z.string().uuid("Identifiant invalide");

export const getNotificationsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    unreadOnly: z.coerce.boolean().default(false),
  }),
});

export const notificationIdSchema = z.object({
  params: z.object({ id: uuidSchema }),
});
