import { z } from "zod";

const uuidSchema = z.string().uuid("Identifiant invalide");

export const syncScansSchema = z.object({
  params: z.object({
    eventId: uuidSchema,
  }),
  body: z.object({
    deviceId: z
      .string()
      .min(1, "L'identifiant appareil est requis"),
    scans: z
      .array(
        z.object({
          ticketId: uuidSchema,
          scannedAt: z
            .string()
            .refine((val) => !isNaN(new Date(val).getTime()), {
              message: "scannedAt invalide — format ISO 8601 attendu",
            }),
        })
      )
      .min(1, "Au moins un scan est requis")
      .max(500, "Maximum 500 scans par batch"),
  }),
});

export const eventIdParamSchema = z.object({
  params: z.object({
    eventId: uuidSchema,
  }),
});