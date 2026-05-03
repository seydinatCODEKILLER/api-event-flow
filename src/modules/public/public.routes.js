import { Router } from "express";
import { PublicController } from "./public.controller.js";
import { validate } from "../../shared/middlewares/validate.middleware.js";
import { generalLimiter } from "../../config/rateLimiter.js";
import { eventIdSchema, registerSchema } from "./public.validator.js";

const router = Router();
const publicController = new PublicController();

router.use(generalLimiter);

/**
 * @swagger
 * /api/public/events:
 *   get:
 *     summary: Lister les événements publics
 *     description: Retourne les événements PUBLISHED et ONGOING. Accessible sans authentification.
 *     tags: [Public]
 *     security: []
 *     responses:
 *       200:
 *         description: Liste des événements publics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: "boolean", example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: "string", format: "uuid" }
 *                       title: { type: "string", example: "Concert Youssou N'Dour" }
 *                       location: { type: "string", example: "Dakar Arena" }
 *                       city: { type: "string", example: "Dakar" }
 *                       startDate: { type: "string", format: "date-time" }
 *                       isFree: { type: "boolean", example: true }
 *                       remainingSpots: { type: "integer", example: 1800 }
 *                       isFull: { type: "boolean", example: false }
 */
router.get("/events", publicController.getPublicEvents);

/**
 * @swagger
 * /api/public/events/{id}:
 *   get:
 *     summary: Détail d'un événement public
 *     tags: [Public]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: "string", format: "uuid" }
 *     responses:
 *       200:
 *         description: Détail de l'événement
 *       404:
 *         description: Événement introuvable
 */
router.get(
  "/events/:id",
  validate(eventIdSchema),
  publicController.getPublicEventById,
);

/**
 * @swagger
 * /api/public/events/{id}/register:
 *   post:
 *     summary: Inscription publique (sans compte)
 *     description: |
 *       Inscription self-service à un événement GRATUIT.
 *       Si l'utilisateur n'existe pas, un compte est créé en background.
 *       Le ticket est envoyé par email si fourni.
 *       (Les événements payants doivent utiliser l'application).
 *     tags: [Public]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: "string", format: "uuid" }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fullName]
 *             properties:
 *               fullName: { type: "string", example: "Fatou Sow" }
 *               email: { type: "string", format: "email", example: "fatou@gmail.com" }
 *               phone: { type: "string", example: "+221771234567" }
 *     responses:
 *       201:
 *         description: Inscription réussie
 *       400:
 *         description: Événement complet ou payant
 *       409:
 *         description: Déjà inscrit avec cet email/téléphone
 */
router.post(
  "/events/:id/register",
  validate(registerSchema),
  publicController.registerToEvent,
);

export default router;
