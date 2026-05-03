import { z } from "zod";

const uuidSchema = z.string().uuid("Identifiant invalide");

export const initiateSchema = z.object({
  body: z.object({
    eventId: uuidSchema,
    method: z.enum(["ORANGE_MONEY", "WAVE", "FREE_MONEY", "CARD"], {
      errorMap: () => ({ message: "Méthode de paiement invalide" }),
    }),
  }),
});

export const confirmSchema = z.object({
  body: z.object({
    reference: z.string().min(1, "La référence est requise"),
    status: z.enum(["COMPLETED", "FAILED"]),
    failureReason: z.string().optional(),
  }),
});

export const paymentIdSchema = z.object({
  params: z.object({ id: uuidSchema }),
});
