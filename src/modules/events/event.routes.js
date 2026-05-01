import { Router } from "express";
import { EventController } from "./event.controller.js";
import { validate } from "../../shared/middlewares/validate.middleware.js";
import {
  authenticate,
  requireEventAccess,
} from "../../shared/middlewares/auth.middleware.js";
import { uploadSingle } from "../../shared/middlewares/upload.middleware.js";
import { sanitizeBody } from "../../shared/middlewares/sanitize.middleware.js";
import { crudLimiter } from "../../config/rateLimiter.js";
import {
  createEventSchema,
  updateEventSchema,
  eventIdSchema,
  getEventsSchema,
  addModeratorSchema,
  removeModeratorSchema,
  publishEventSchema,
  closeEventSchema,
  eventStatsSchema,
  eventTicketsSchema,
  eventParticipantsSchema,
} from "./event.validator.js";

const router = Router();
const eventController = new EventController();

router.use(authenticate);
router.use(crudLimiter);

// ─── CRUD événements ──────────────────────────────────────────

/**
 * @swagger
 * /api/events:
 *   post:
 *     summary: Créer un événement
 *     description: Tout utilisateur connecté peut créer un événement.
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - location
 *               - startDate
 *               - capacity
 *             properties:
 *               title:
 *                 type: string
 *                 example: Concert Youssou N'Dour
 *               description:
 *                 type: string
 *               location:
 *                 type: string
 *               city:
 *                 type: string
 *               latitude:
 *                 type: number
 *               longitude:
 *                 type: number
 *               category:
 *                 type: string
 *                 enum: [CONCERT, CONFERENCE, SPORT, FETE, ART, GASTRONOMIE, AUTRE]
 *               startDate:
 *                 type: string
 *                 format: date-time
 *               endDate:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *               capacity:
 *                 type: integer
 *               isFree:
 *                 type: boolean
 *                 default: true
 *               price:
 *                 type: number
 *                 nullable: true
 *               currency:
 *                 type: string
 *                 default: "XOF"
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Événement créé
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: "boolean", example: true }
 *                 message: { type: "string", example: "Événement créé avec succès" }
 *                 data:
 *                   $ref: '#/components/schemas/Event'
 */
router.post(
  "/",
  uploadSingle("image"),
  sanitizeBody,
  validate(createEventSchema),
  eventController.createEvent,
);

/**
 * @swagger
 * /api/events:
 *   get:
 *     summary: Lister mes événements créés
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/pageQuery'
 *       - in: query
 *         name: limit
 *         required: false
 *         schema: { type: "integer", default: 10 }
 *       - in: query
 *         name: status
 *         required: false
 *         schema:
 *           type: string
 *           enum: [DRAFT, PUBLISHED, ONGOING, CLOSED]
 *     responses:
 *       200:
 *         description: Liste paginée
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: "boolean", example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Event'
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationMeta'
 */
router.get("/", validate(getEventsSchema), eventController.getEvents);

/**
 * @swagger
 * /api/events/{id}:
 *   get:
 *     summary: Détail d'un événement
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: "string", format: "uuid" }
 *     responses:
 *       200:
 *         description: Détail complet (organisateur et modérateurs inclus)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: "boolean", example: true }
 *                 data:
 *                   $ref: '#/components/schemas/EventFull'
 */
router.get(
  "/:id",
  requireEventAccess,
  validate(eventIdSchema),
  eventController.getEventById,
);

/**
 * @swagger
 * /api/events/{id}:
 *   patch:
 *     summary: Modifier un événement
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: "string", format: "uuid" }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: "string" }
 *               description: { type: "string" }
 *               location: { type: "string" }
 *               city: { type: "string" }
 *               latitude: { type: "number" }
 *               longitude: { type: "number" }
 *               category: { type: "string", enum: [CONCERT, CONFERENCE, SPORT, FETE, ART, GASTRONOMIE, AUTRE] }
 *               startDate: { type: "string", format: "date-time" }
 *               endDate: { type: "string", format: "date-time", nullable: true }
 *               capacity: { type: "integer" }
 *               isFree: { type: "boolean" }
 *               price: { type: "number", nullable: true }
 *               currency: { type: "string" }
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Événement mis à jour
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: "boolean", example: true }
 *                 message: { type: "string", example: "Événement mis à jour avec succès" }
 *                 data:
 *                   $ref: '#/components/schemas/Event'
 */
router.patch(
  "/:id",
  uploadSingle("image"),
  sanitizeBody,
  validate(updateEventSchema),
  eventController.updateEvent,
);

/**
 * @swagger
 * /api/events/{id}:
 *   delete:
 *     summary: Supprimer un événement
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: "string", format: "uuid" }
 *     responses:
 *       200:
 *         description: Événement supprimé
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 */
router.delete("/:id", validate(eventIdSchema), eventController.deleteEvent);

// ─── Statuts & Workflows ──────────────────────────────────────

/**
 * @swagger
 * /api/events/{id}/publish:
 *   patch:
 *     summary: Publier un événement
 *     description: Change le statut de l'événement à PUBLISHED.
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: "string", format: "uuid" }
 *     responses:
 *       200:
 *         description: Événement publié
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: "boolean", example: true }
 *                 message: { type: "string", example: "Événement publié avec succès" }
 *                 data:
 *                   $ref: '#/components/schemas/Event'
 */
router.patch(
  "/:id/publish",
  validate(publishEventSchema),
  eventController.publishEvent,
);

/**
 * @swagger
 * /api/events/{id}/close:
 *   patch:
 *     summary: Clôturer un événement
 *     description: Change le statut de l'événement à CLOSED.
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: "string", format: "uuid" }
 *     responses:
 *       200:
 *         description: Événement clôturé
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: "boolean", example: true }
 *                 message: { type: "string", example: "Événement clôturé avec succès" }
 *                 data:
 *                   $ref: '#/components/schemas/Event'
 */
router.patch(
  "/:id/close",
  validate(closeEventSchema),
  eventController.closeEvent,
);

// ─── Modérateurs ───────────────────────────────────────────────

/**
 * @swagger
 * /api/events/{id}/moderators:
 *   post:
 *     summary: Assigner un modérateur existant
 *     description: Réservé à l'organisateur. L'utilisateur doit avoir un compte vérifié (ACTIVE).
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
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
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: moussa@gmail.com
 *     responses:
 *       201:
 *         description: Modérateur assigné
 *       404:
 *         description: Aucun compte trouvé avec cet email
 *       409:
 *         description: Déjà assigné
 */
router.post(
  "/:id/moderators",
  validate(addModeratorSchema),
  eventController.addModerator,
);

/**
 * @swagger
 * /api/events/{eventId}/moderators/{moderatorId}:
 *   delete:
 *     summary: Retirer un modérateur
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/eventIdParam'
 *       - in: path
 *         name: moderatorId
 *         required: true
 *         schema: { type: "string", format: "uuid" }
 *     responses:
 *       200:
 *         description: Modérateur retiré
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 */
router.delete(
  "/:eventId/moderators/:moderatorId",
  validate(removeModeratorSchema),
  eventController.removeModerator,
);

// ─── Tickets & Participants (Users) ───────────────────────────

/**
 * @swagger
 * /api/events/{id}/tickets:
 *   get:
 *     summary: Lister les tickets d'un événement
 *     description: Récupère la liste paginée de tous les tickets générés pour un événement.
 *     tags: [Events]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: "string", format: "uuid" }
 *       - $ref: '#/components/parameters/pageQuery'
 *       - $ref: '#/components/parameters/limitQuery'
 *       - $ref: '#/components/parameters/ticketStatusQuery'
 *     responses:
 *       200:
 *         description: Liste des tickets récupérée avec succès
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
 *         description: Accès refusé à cet événement
 *       404:
 *         description: Événement introuvable
 */
router.get(
  "/:id/tickets",
  requireEventAccess,
  validate(eventTicketsSchema),
  eventController.getEventTickets,
);

/**
 * @swagger
 * /api/events/{id}/participants:
 *   get:
 *     summary: Lister les participants d'un événement
 *     description: |
 *       Récupère la liste paginée des utilisateurs (Users) possédant un ticket pour cet événement.
 *       (La table Participant n'existe pas, un participant est un User lié à un Ticket).
 *     tags: [Events]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: "string", format: "uuid" }
 *       - $ref: '#/components/parameters/pageQuery'
 *       - $ref: '#/components/parameters/limitQuery'
 *       - in: query
 *         name: search
 *         required: false
 *         description: "Rechercher par nom ou email"
 *         schema: { type: "string" }
 *     responses:
 *       200:
 *         description: Liste des participants (Users) récupérée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: "boolean", example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationMeta'
 *       403:
 *         description: Accès refusé à cet événement
 *       404:
 *         description: Événement introuvable
 */
router.get(
  "/:id/participants",
  requireEventAccess,
  validate(eventParticipantsSchema),
  eventController.getEventParticipants,
);

// ─── Stats ─────────────────────────────────────────────────────

/**
 * @swagger
 * /api/events/{id}/stats:
 *   get:
 *     summary: Statistiques d'un événement
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: "string", format: "uuid" }
 *     responses:
 *       200:
 *         description: Statistiques
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: "boolean", example: true }
 *                 data:
 *                   $ref: '#/components/schemas/EventStats'
 */
router.get(
  "/:id/stats",
  requireEventAccess,
  validate(eventStatsSchema),
  eventController.getEventStats,
);

export default router;
