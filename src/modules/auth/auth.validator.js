import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, "Le mot de passe doit contenir au moins 8 caractères")
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    "Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre",
  );

export const registerSchema = z.object({
  body: z.object({
    nom: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
    prenom: z.string().min(2, "Le prenom doit contenir au moins 2 caractères"),
    email: z.string().email("Adresse email invalide").toLowerCase(),
    password: passwordSchema,
    role: z.enum(["ORGANIZER", "MODERATOR"], {
      errorMap: () => ({ message: "Le rôle doit être ORGANIZER ou MODERATOR" }),
    }),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email("Adresse email invalide").toLowerCase(),
    password: z.string().min(1, "Le mot de passe est requis"),
    deviceId: z.string().optional(), // identifiant appareil mobile
  }),
});

export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, "Le refresh token est requis"),
  }),
});

export const updateProfileSchema = z.object({
  body: z
    .object({
      nom: z
        .string()
        .min(2, "Le nom doit contenir au moins 2 caractères")
        .optional(),
      prenom: z
        .string()
        .min(2, "Le prenom doit contenir au moins 2 caractères")
        .optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "Au moins un champ doit être fourni",
    }),
});
