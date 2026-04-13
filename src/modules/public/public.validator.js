import { z } from "zod";

const uuidSchema = z.string().uuid("Identifiant invalide");

export const eventIdParamSchema = z.object({
  params: z.object({
    eventId: uuidSchema,
  }),
});

export const registerSchema = z.object({
  params: z.object({
    eventId: uuidSchema,
  }),
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
      message: "Un email ou un numéro de téléphone est requis",
    }),
});