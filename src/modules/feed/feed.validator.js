import { z } from "zod";

const uuidSchema = z.string().uuid("Identifiant invalide");

export const getFeedSchema = z.object({
  query: z.object({
    cursor: z.string().uuid().optional(), // id du dernier event vu
    limit: z.coerce.number().int().positive().max(50).default(20),
    category: z
      .enum([
        "CONCERT",
        "CONFERENCE",
        "SPORT",
        "FETE",
        "ART",
        "GASTRONOMIE",
        "AUTRE",
      ])
      .optional(),
    city: z.string().optional(),
    search: z.string().optional(),
    isFree: z.coerce.boolean().optional(),
  }),
});

export const getNearbySchema = z.object({
  query: z.object({
    latitude: z.coerce.number().min(-90).max(90),
    longitude: z.coerce.number().min(-180).max(180),
    radius: z.coerce.number().int().min(1).max(100).default(50),
    limit: z.coerce.number().int().positive().max(50).default(20),
  }),
});

export const eventIdSchema = z.object({
  params: z.object({ id: uuidSchema }),
});

export const registerSchema = z.object({
  params: z.object({ id: z.string().uuid("Identifiant invalide") }),
  body: z
    .object({
      method: z.enum(["ORANGE_MONEY", "WAVE", "FREE_MONEY", "CARD"]).optional(),
    })
    .optional()
    .default({}),
});
