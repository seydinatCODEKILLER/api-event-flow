import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, "Le mot de passe doit contenir au moins 8 caractères")
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    "Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre",
  );

  const phoneSchema = z
  .string()
  .regex(
    /^\+221(77|70|78|76)\d{7}$/,
    "Le numéro doit être au format +22177XXXXXXX, +22170XXXXXXX, +22178XXXXXXX ou +22176XXXXXXX",
  );

export const registerSchema = z.object({
  body: z.object({
    fullName: z.string().min(2, "Le nom complet doit contenir au moins 2 caractères"),
    email: z.string().email("Adresse email invalide").toLowerCase(),
    password: passwordSchema,
    phone: phoneSchema.optional(),
  }),
});

export const verifyEmailSchema = z.object({
  body: z.object({
    token: z.string().min(1, "Le token de vérification est requis"),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email("Adresse email invalide").toLowerCase(),
    password: z.string().min(1, "Le mot de passe est requis"),
    deviceId: z.string().optional(),
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
      fullName: z
        .string()
        .min(2, "Le nom complet doit contenir au moins 2 caractères")
        .optional(),
      phone: phoneSchema.optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "Au moins un champ doit être fourni",
    }),
});

export const activateAccountSchema = z.object({
  body: z.object({
    token: z.string().min(1, "Le token d'activation est requis"),
    password: passwordSchema,
  }),
});