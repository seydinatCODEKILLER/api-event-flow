import { Router } from "express";
import { TicketController } from "./ticket.controller.js";
import { validate } from "../../shared/middlewares/validate.middleware.js";
import {
  authenticate,
} from "../../shared/middlewares/auth.middleware.js"; 
import { crudLimiter } from "../../config/rateLimiter.js";
import {
  getTicketsSchema,
  ticketIdSchema,
  syncTicketsSchema,
  validateTicketSchema,
} from "./ticket.validator.js";

const ticketController = new TicketController();

export const ticketRouter = Router({ mergeParams: true });
ticketRouter.use(authenticate);
ticketRouter.use(crudLimiter);

/**
 * @swagger
 * /api/events/{eventId}/tickets:
 *   get:
 *     summary: Lister les tickets d'un événement
 *     tags: [Tickets]
 *     parameters:
 *       - $ref: '#/components/parameters/eventIdParam'
 *       - $ref: '#/components/parameters/pageQuery'
 *       - $ref: '#/components/parameters/limitQuery'
 *       - $ref: '#/components/parameters/ticketStatusQuery'
 *     responses:
 *       200:
 *         description: Liste des tickets avec pagination
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: "boolean", example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/TicketListItem'
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationMeta'
 *       403:
 *         description: Accès non autorisé
 *       404:
 *         description: Événement introuvable
 */
ticketRouter.get("/", validate(getTicketsSchema), ticketController.getTickets);

/**
 * @swagger
 * /api/events/{eventId}/tickets/sync:
 *   get:
 *     summary: Télécharger les tickets pour scan offline (mobile)
 *     description: |
 *       Utilisé par l'app mobile avant l'événement pour télécharger
 *       tous les tickets ACTIVE dans SQLite local.
 *       Réservé aux modérateurs assignés à l'événement.
 *     tags: [Tickets]
 *     parameters:
 *       - $ref: '#/components/parameters/eventIdParam'
 *     responses:
 *       200:
 *         description: Liste des tickets pour sync offline
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: "boolean", example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/TicketSyncItem'
 *       403:
 *         description: Modérateur non assigné à cet événement
 */
ticketRouter.get(
  "/sync",
  validate(syncTicketsSchema),
  ticketController.getTicketsForSync,
);

/**
 * @swagger
 * /api/events/{eventId}/tickets/{ticketId}:
 *   get:
 *     summary: Détail d'un ticket
 *     tags: [Tickets]
 *     parameters:
 *       - $ref: '#/components/parameters/eventIdParam'
 *       - $ref: '#/components/parameters/ticketIdParam'
 *     responses:
 *       200:
 *         description: Détail du ticket avec l'utilisateur et les logs d'emails
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: "boolean", example: true }
 *                 data:
 *                   $ref: '#/components/schemas/TicketDetails'
 *       403:
 *         description: Accès non autorisé
 *       404:
 *         description: Ticket introuvable
 */
ticketRouter.get(
  "/:ticketId",
  validate(ticketIdSchema),
  ticketController.getTicketById,
);

/**
 * @swagger
 * /api/events/{eventId}/tickets/{ticketId}/send-email:
 *   post:
 *     summary: Envoyer le ticket par email à l'utilisateur
 *     tags: [Tickets]
 *     parameters:
 *       - $ref: '#/components/parameters/eventIdParam'
 *       - $ref: '#/components/parameters/ticketIdParam'
 *     responses:
 *       200:
 *         description: Email envoyé avec succès
 *       400:
 *         description: Utilisateur sans email ou ticket annulé
 *       403:
 *         description: Non organisateur de l'événement
 *       404:
 *         description: Ticket introuvable
 */
ticketRouter.post(
  "/:ticketId/send-email",
  validate(ticketIdSchema),
  ticketController.sendTicketEmail,
);

/**
 * @swagger
 * /api/events/{eventId}/tickets/{ticketId}/resend-email:
 *   post:
 *     summary: Renvoyer le ticket par email (doublon intentionnel tracé)
 *     tags: [Tickets]
 *     parameters:
 *       - $ref: '#/components/parameters/eventIdParam'
 *       - $ref: '#/components/parameters/ticketIdParam'
 *     responses:
 *       200:
 *         description: Email renvoyé avec succès
 *       400:
 *         description: Utilisateur sans email ou ticket annulé
 *       404:
 *         description: Ticket introuvable
 */
ticketRouter.post(
  "/:ticketId/resend-email",
  validate(ticketIdSchema),
  ticketController.resendTicketEmail,
);

/**
 * @swagger
 * /api/events/{eventId}/tickets/{ticketId}/cancel:
 *   patch:
 *     summary: Annuler un ticket
 *     description: |
 *       Annule le ticket et supprime le QR code de Cloudinary.
 *       Un ticket USED ne peut pas être annulé.
 *     tags: [Tickets]
 *     parameters:
 *       - $ref: '#/components/parameters/eventIdParam'
 *       - $ref: '#/components/parameters/ticketIdParam'
 *     responses:
 *       200:
 *         description: Ticket annulé avec succès
 *       400:
 *         description: Ticket déjà utilisé ou déjà annulé
 *       403:
 *         description: Non organisateur de l'événement
 *       404:
 *         description: Ticket introuvable
 */
ticketRouter.patch(
  "/:ticketId/cancel",
  validate(ticketIdSchema),
  ticketController.cancelTicket,
);

// ─── Router standalone /api/tickets ───────────────────────────
export const ticketStandaloneRouter = Router();

ticketStandaloneRouter.use(authenticate);
ticketStandaloneRouter.use(crudLimiter);

/**
 * @swagger
 * /api/tickets/validate:
 *   post:
 *     summary: Valider un ticket online (scan en temps réel)
 *     description: |
 *       Décode le JWT du QR code, vérifie le statut du ticket,
 *       le marque USED et crée un ScanLog synchronisé immédiatement.
 *       Le QR payload contient déjà ticketId + eventId + userId —
 *       pas besoin de passer l'eventId dans l'URL.
 *       Réservé aux modérateurs assignés à l'événement concerné.
 *     tags: [Tickets]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [qrPayload, deviceId]
 *             properties:
 *               qrPayload:
 *                 type: string
 *                 description: Contenu scanné du QR code (JWT signé)
 *                 example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *               deviceId:
 *                 type: string
 *                 description: Identifiant unique de l'appareil mobile
 *                 example: "expo-device-abc123"
 *     responses:
 *       200:
 *         description: Résultat de la validation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     result:
 *                       type: string
 *                       enum: [VALID, ALREADY_USED, INVALID]
 *                       example: "VALID"
 *                     message:
 *                       type: string
 *                       example: "Entrée validée"
 *                     user:
 *                       description: "Informations de l'utilisateur propriétaire du ticket"
 *                       $ref: '#/components/schemas/User'
 *                     event:
 *                       type: object
 *                       nullable: true
 *                       properties:
 *                         title:
 *                           type: string
 *                           example: "Concert Youssou N'Dour"
 *                         location:
 *                           type: string
 *                           example: "Dakar Arena"
 *                     usedAt:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *                       description: Présent uniquement si result = ALREADY_USED
 *       400:
 *         description: QR payload manquant ou deviceId manquant
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Modérateur non assigné à l'événement du ticket
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
ticketStandaloneRouter.post(
  "/validate",
  validate(validateTicketSchema),
  ticketController.validateTicket,
);
