import { Router } from "express";
import { PublicController } from "./public.controller.js";
import { validate } from "../../shared/middlewares/validate.middleware.js";
import { generalLimiter } from "../../config/rateLimiter.js";
import { eventIdParamSchema, registerSchema } from "./public.validator.js";

const router = Router();
const publicController = new PublicController();

// Rate limiter général — pas d'auth sur ces routes
router.use(generalLimiter);

/**
 * @swagger
 * /api/public/events:
 *   get:
 *     summary: Lister les événements publics
 *     description: |
 *       Retourne les événements PUBLISHED et ONGOING.
 *       Accessible sans authentification.
 *       Inclut le nombre de places restantes.
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
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       title:
 *                         type: string
 *                         example: "Concert Youssou N'Dour"
 *                       location:
 *                         type: string
 *                         example: "Dakar Arena"
 *                       startDate:
 *                         type: string
 *                         format: date-time
 *                       endDate:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                       capacity:
 *                         type: integer
 *                         example: 5000
 *                       remainingSpots:
 *                         type: integer
 *                         example: 1800
 *                       status:
 *                         type: string
 *                         enum: [PUBLISHED, ONGOING]
 *                       isFull:
 *                         type: boolean
 *                         example: false
 */
router.get("/events", publicController.getPublicEvents);

/**
 * @swagger
 * /api/public/events/{eventId}:
 *   get:
 *     summary: Détail d'un événement public
 *     description: |
 *       Retourne le détail d'un événement PUBLISHED ou ONGOING.
 *       N'expose jamais la liste des participants ou des tickets.
 *       Accessible sans authentification.
 *     tags: [Public]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Détail de l'événement
 *       404:
 *         description: Événement introuvable ou non publié
 */
router.get(
  "/events/:eventId",
  validate(eventIdParamSchema),
  publicController.getPublicEventById
);

/**
 * @swagger
 * /api/public/events/{eventId}/register:
 *   post:
 *     summary: S'inscrire à un événement
 *     description: |
 *       Inscription self-service d'un participant à un événement publié.
 *       Accessible sans authentification.
 *
 *       Flux complet :
 *       1. Vérifie que l'événement est PUBLISHED
 *       2. Vérifie que la capacité n'est pas atteinte
 *       3. Vérifie l'absence de doublon (email ou téléphone)
 *       4. Crée le participant si inexistant
 *       5. Génère le ticket + QR code
 *       6. Envoie le ticket par email automatiquement (si email fourni)
 *     tags: [Public]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fullName]
 *             properties:
 *               fullName:
 *                 type: string
 *                 example: "Fatou Sow"
 *               email:
 *                 type: string
 *                 example: "fatou@gmail.com"
 *                 description: Requis pour recevoir le ticket par email
 *               phone:
 *                 type: string
 *                 example: "+221771234567"
 *           examples:
 *             avec_email:
 *               summary: Inscription avec email
 *               value:
 *                 fullName: "Fatou Sow"
 *                 email: "fatou@gmail.com"
 *                 phone: "+221771234567"
 *             sans_email:
 *               summary: Inscription sans email (téléphone uniquement)
 *               value:
 *                 fullName: "Moussa Diop"
 *                 phone: "+221781234567"
 *     responses:
 *       201:
 *         description: Inscription réussie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Inscription réussie ! Vérifiez votre email pour votre ticket."
 *                 data:
 *                   type: object
 *                   properties:
 *                     participantId:
 *                       type: string
 *                       format: uuid
 *                     ticketId:
 *                       type: string
 *                       format: uuid
 *                     fullName:
 *                       type: string
 *                       example: "Fatou Sow"
 *                     email:
 *                       type: string
 *                       nullable: true
 *                     emailSent:
 *                       type: boolean
 *                       example: true
 *                     event:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           format: uuid
 *                         title:
 *                           type: string
 *                         location:
 *                           type: string
 *                         startDate:
 *                           type: string
 *                           format: date-time
 *       400:
 *         description: Événement complet ou inscriptions fermées
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Événement introuvable
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Participant déjà inscrit à cet événement
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  "/events/:eventId/register",
  validate(registerSchema),
  publicController.registerToEvent
);

export default router;