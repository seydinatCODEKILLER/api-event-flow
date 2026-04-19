import { z } from "zod";

const uuidSchema = z.string().uuid("Identifiant invalide");

export const createEventSchema = z.object({
  body: z.object({
    title: z.string().min(2, "Le titre doit contenir au moins 2 caractères"),
    location: z.string().min(2, "Le lieu doit contenir au moins 2 caractères"),
    startDate: z
      .string()
      .or(z.date())
      .refine((val) => !isNaN(new Date(val).getTime()), {
        message: "Date de début invalide",
      }),
    endDate: z
      .string()
      .or(z.date())
      .refine((val) => !isNaN(new Date(val).getTime()), {
        message: "Date de fin invalide",
      })
      .optional(),
    capacity: z.coerce
      .number()
      .int("La capacité doit être un entier")
      .positive("La capacité doit être positive"),
  }),
});

export const updateEventSchema = z.object({
  params: z.object({ id: uuidSchema }),
  body: z
    .object({
      title: z.string().min(2).optional(),
      location: z.string().min(2).optional(),
      startDate: z
        .string()
        .or(z.date())
        .refine((val) => !isNaN(new Date(val).getTime()), {
          message: "Date de début invalide",
        })
        .optional(),
      endDate: z
        .string()
        .or(z.date())
        .refine((val) => !isNaN(new Date(val).getTime()), {
          message: "Date de fin invalide",
        })
        .nullable()
        .optional(),
      capacity: z.coerce
        .number()
        .int("La capacité doit être un entier")
        .positive("La capacité doit être positive")
        .optional(),

      status: z
        .enum(["DRAFT", "PUBLISHED", "ONGOING", "CLOSED"], {
          errorMap: () => ({ message: "Statut invalide" }),
        })
        .optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "Au moins un champ doit être fourni",
    }),
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
    moderatorId: uuidSchema,
  }),
});

export const removeModeratorSchema = z.object({
  params: z.object({
    eventId: uuidSchema,
    moderatorId: uuidSchema,
  }),
});
