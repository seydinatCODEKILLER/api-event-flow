import { z } from "zod";

const uuidSchema = z.string().uuid("Identifiant invalide");

const dateSchema = z
  .string()
  .or(z.date())
  .refine((val) => !isNaN(new Date(val).getTime()), {
    message: "Date invalide",
  });

export const createEventSchema = z.object({
  body: z
    .object({
      title: z.string().min(2, "Le titre doit contenir au moins 2 caractères"),
      description: z.string().optional(),
      location: z
        .string()
        .min(2, "Le lieu doit contenir au moins 2 caractères"),
      city: z.string().optional(),
      latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
      longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
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
        .default("AUTRE"),
      startDate: dateSchema,
      endDate: dateSchema.optional().nullable(),
      capacity: z.coerce
        .number()
        .int("La capacité doit être un entier")
        .positive("La capacité doit être positive"),
      isFree: z.boolean().default(true),
      price: z.coerce
        .number()
        .positive("Le prix doit être positif")
        .optional()
        .nullable(),
      currency: z.string().default("XOF"),
      status: z.enum(["DRAFT", "PUBLISHED"]).default("DRAFT"),
    })
    .refine(
      (data) => {
        if (data.isFree === false && (!data.price || data.price <= 0))
          return false;
        return true;
      },
      {
        message: "Le prix est requis pour un événement payant",
        path: ["price"],
      },
    ),
});

export const updateEventSchema = z.object({
  params: z.object({ id: uuidSchema }),
  body: z
    .object({
      title: z.string().min(2).optional(),
      description: z.string().optional().nullable(),
      location: z.string().min(2).optional(),
      city: z.string().optional().nullable(),
      latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
      longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
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
      startDate: dateSchema.optional(),
      endDate: dateSchema.optional().nullable(),
      capacity: z.coerce
        .number()
        .int("La capacité doit être un entier")
        .positive("La capacité doit être positive")
        .optional(),
      isFree: z.boolean().optional(),
      price: z.coerce
        .number()
        .positive("Le prix doit être positif")
        .optional()
        .nullable(),
      currency: z.string().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "Au moins un champ doit être fourni",
    })
    .refine(
      (data) => {
        if (data.isFree === false && (!data.price || data.price <= 0))
          return false;
        return true;
      },
      {
        message: "Le prix est requis pour un événement payant",
        path: ["price"],
      },
    ),
});

export const eventIdSchema = z.object({
  params: z.object({ id: uuidSchema }),
});

export const getEventsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(50).default(10),
    status: z.enum(["DRAFT", "PUBLISHED", "ONGOING", "CLOSED"]).optional(),
  }),
});

export const addModeratorSchema = z.object({
  params: z.object({ id: uuidSchema }),
  body: z.object({
    email: z.string().email("Email invalide"),
  }),
});

export const removeModeratorSchema = z.object({
  params: z.object({
    eventId: uuidSchema,
    moderatorId: uuidSchema,
  }),
});

export const publishEventSchema = z.object({
  params: z.object({ id: uuidSchema }),
});

export const closeEventSchema = z.object({
  params: z.object({ id: uuidSchema }),
});

export const eventStatsSchema = z.object({
  params: z.object({ id: uuidSchema }),
});

export const eventTicketsSchema = z.object({
  params: z.object({ id: uuidSchema }),
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    status: z.enum(["ACTIVE", "USED", "CANCELLED"]).optional(),
  }),
});

export const eventParticipantsSchema = z.object({
  params: z.object({ id: uuidSchema }),
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    search: z.string().optional(),
  }),
});