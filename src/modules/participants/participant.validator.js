import { z } from "zod";

const uuidSchema = z.string().uuid("Identifiant invalide");

const eventParamsSchema = z.object({
  eventId: uuidSchema,
});

const participantParamsSchema = z.object({
  eventId: uuidSchema,
  participantId: uuidSchema,
});

export const addParticipantSchema = z.object({
  params: eventParamsSchema,
  body: z
    .object({
      fullName: z
        .string()
        .min(2, "Le nom complet doit contenir au moins 2 caractères"),
      email: z
        .string()
        .email("Adresse email invalide")
        .toLowerCase()
        .optional()
        .nullable(),
      phone: z
        .string()
        .min(8, "Numéro de téléphone invalide")
        .optional()
        .nullable(),
    })
    .refine((data) => data.email || data.phone, {
      message: "Au moins un email ou un numéro de téléphone est requis",
    }),
});

export const importCsvSchema = z.object({
  params: eventParamsSchema,
});

export const getParticipantsSchema = z.object({
  params: eventParamsSchema,
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    search: z.string().optional(),
  }),
});

export const participantIdSchema = z.object({
  params: participantParamsSchema,
});

export const updateParticipantSchema = z.object({
  params: participantParamsSchema,
  body: z
    .object({
      fullName: z.string().min(2).optional(),
      email: z
        .string()
        .email("Adresse email invalide")
        .toLowerCase()
        .nullable()
        .optional(),
      phone: z
        .string()
        .min(8, "Numéro de téléphone invalide")
        .nullable()
        .optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "Au moins un champ doit être fourni",
    }),
});
