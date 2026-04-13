import { z } from "zod";

const uuidSchema = z.string().uuid("Identifiant invalide");

export const getTicketsSchema = z.object({
  params: z.object({ eventId: uuidSchema }),
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    status: z.enum(["ACTIVE", "USED", "CANCELLED"]).optional(),
  }),
});

export const ticketIdSchema = z.object({
  params: z.object({ ticketId: uuidSchema }),
});

export const syncTicketsSchema = z.object({
  params: z.object({ eventId: uuidSchema }),
});

export const validateTicketSchema = z.object({
  body: z.object({
    qrPayload: z.string().min(1, "Le QR payload est requis"),
    deviceId: z.string().min(1, "L'identifiant appareil est requis"),
  }),
});