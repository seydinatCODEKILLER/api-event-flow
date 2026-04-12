import { Router } from "express";
import { EventController } from "./event.controller.js";
import { validate } from "../../shared/middlewares/validate.middleware.js";
import { authenticate, requireRole } from "../../shared/middlewares/auth.middleware.js";
import { crudLimiter } from "../../config/rateLimiter.js";
import {
  createEventSchema,
  updateEventSchema,
  eventIdSchema,
  getEventsSchema,
  addModeratorSchema,
  removeModeratorSchema,
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
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, location, startDate, capacity]
 *             properties:
 *               title:
 *                 type: string
 *                 example: "Concert Youssou N'Dour"
 *               location:
 *                 type: string
 *                 example: "Dakar Arena"
 *               startDate:
 *                 type: string
 *                 format: date-time
 *                 example: "2025-12-01T20:00:00Z"
 *               endDate:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *                 example: "2025-12-01T23:00:00Z"
 *               capacity:
 *                 type: integer
 *                 example: 5000
 *     responses:
 *       201:
 *         description: Événement créé avec succès
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
 *                   example: "Événement créé avec succès"
 *                 data:
 *                   $ref: '#/components/schemas/Event'
 *       400:
 *         description: Données invalides
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Réservé aux organisateurs
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  "/",
  requireRole("ORGANIZER"),
  validate(createEventSchema),
  eventController.createEvent
);

/**
 * @swagger
 * /api/events:
 *   get:
 *     summary: Lister ses événements (organisateur)
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *           minimum: 1
 *         description: Numéro de page
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           minimum: 1
 *           maximum: 50
 *         description: Nombre d'éléments par page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [DRAFT, PUBLISHED, ONGOING, CLOSED]
 *         description: Filtrer par statut
 *     responses:
 *       200:
 *         description: Liste des événements avec pagination
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
 *                     $ref: '#/components/schemas/Event'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                       example: 42
 *                     page:
 *                       type: integer
 *                       example: 1
 *                     limit:
 *                       type: integer
 *                       example: 10
 *                     totalPages:
 *                       type: integer
 *                       example: 5
 *       403:
 *         description: Réservé aux organisateurs
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get(
  "/",
  requireRole("ORGANIZER"),
  validate(getEventsSchema),
  eventController.getEvents
);

/**
 * @swagger
 * /api/events/{id}:
 *   get:
 *     summary: Détail d'un événement
 *     description: |
 *       Accessible par l'organisateur propriétaire et les modérateurs assignés.
 *       Retourne le détail complet avec la liste des modérateurs et les compteurs
 *       de tickets et de scans.
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Identifiant de l'événement
 *     responses:
 *       200:
 *         description: Détail de l'événement
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/EventFull'
 *       403:
 *         description: Accès non autorisé à cet événement
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
 */
router.get(
  "/:id",
  validate(eventIdSchema),
  eventController.getEventById
);

/**
 * @swagger
 * /api/events/{id}:
 *   patch:
 *     summary: Modifier un événement
 *     description: |
 *       Réservé à l'organisateur propriétaire de l'événement.
 *       Tous les champs sont optionnels — seuls les champs fournis sont mis à jour.
 *       Un événement clôturé (CLOSED) ne peut plus être modifié.
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Identifiant de l'événement
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             minProperties: 1
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 2
 *                 example: "Concert Youssou N'Dour — Edition Spéciale"
 *               location:
 *                 type: string
 *                 minLength: 2
 *                 example: "Stade Léopold Sédar Senghor"
 *               startDate:
 *                 type: string
 *                 format: date-time
 *                 example: "2025-12-01T20:00:00Z"
 *               endDate:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *                 example: "2025-12-01T23:30:00Z"
 *               capacity:
 *                 type: integer
 *                 minimum: 1
 *                 example: 8000
 *               status:
 *                 type: string
 *                 enum: [DRAFT, PUBLISHED, ONGOING, CLOSED]
 *                 example: "PUBLISHED"
 *           examples:
 *             publication:
 *               summary: Publier un événement
 *               value:
 *                 status: "PUBLISHED"
 *             modification_lieu:
 *               summary: Changer le lieu et la capacité
 *               value:
 *                 location: "Stade Léopold Sédar Senghor"
 *                 capacity: 8000
 *             modification_complete:
 *               summary: Modification complète
 *               value:
 *                 title: "Concert Edition Spéciale"
 *                 location: "Dakar Arena"
 *                 startDate: "2025-12-01T20:00:00Z"
 *                 endDate: "2025-12-01T23:30:00Z"
 *                 capacity: 5000
 *                 status: "PUBLISHED"
 *     responses:
 *       200:
 *         description: Événement mis à jour avec succès
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
 *                   example: "Événement mis à jour avec succès"
 *                 data:
 *                   $ref: '#/components/schemas/Event'
 *       400:
 *         description: Données invalides ou événement clôturé
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               validation:
 *                 summary: Erreur de validation
 *                 value:
 *                   success: false
 *                   code: "VALIDATION_ERROR"
 *                   message: "Au moins un champ doit être fourni"
 *               cloture:
 *                 summary: Événement clôturé
 *                 value:
 *                   success: false
 *                   code: "BAD_REQUEST"
 *                   message: "Un événement clôturé ne peut plus être modifié"
 *       403:
 *         description: Non propriétaire de l'événement
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
 */
router.patch(
  "/:id",
  requireRole("ORGANIZER"),
  validate(updateEventSchema),
  eventController.updateEvent
);

/**
 * @swagger
 * /api/events/{id}:
 *   delete:
 *     summary: Supprimer un événement
 *     description: |
 *       Réservé à l'organisateur propriétaire.
 *       Un événement en cours (ONGOING) ne peut pas être supprimé.
 *       La suppression est en cascade — tickets et scan logs associés sont supprimés.
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Identifiant de l'événement
 *     responses:
 *       200:
 *         description: Événement supprimé avec succès
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
 *                   example: "Événement supprimé avec succès"
 *       400:
 *         description: Événement en cours — suppression impossible
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Non propriétaire de l'événement
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
 */
router.delete(
  "/:id",
  requireRole("ORGANIZER"),
  validate(eventIdSchema),
  eventController.deleteEvent
);

// ─── Modérateurs ──────────────────────────────────────────────

/**
 * @swagger
 * /api/events/{id}/moderators:
 *   get:
 *     summary: Lister les modérateurs d'un événement
 *     description: Accessible par l'organisateur propriétaire et les modérateurs assignés.
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Identifiant de l'événement
 *     responses:
 *       200:
 *         description: Liste des modérateurs assignés
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
 *                       name:
 *                         type: string
 *                         example: "Moussa Ndiaye"
 *                       email:
 *                         type: string
 *                         example: "moussa@eventflow.com"
 *                       avatarUrl:
 *                         type: string
 *                         nullable: true
 *                       assignedAt:
 *                         type: string
 *                         format: date-time
 *       403:
 *         description: Accès non autorisé
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
 */
router.get(
  "/:id/moderators",
  validate(eventIdSchema),
  eventController.getModerators
);

/**
 * @swagger
 * /api/events/{id}/moderators:
 *   post:
 *     summary: Assigner un modérateur à un événement
 *     description: |
 *       Réservé à l'organisateur propriétaire.
 *       L'utilisateur ciblé doit avoir le rôle MODERATOR.
 *       Un modérateur ne peut être assigné qu'une seule fois par événement.
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Identifiant de l'événement
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [moderatorId]
 *             properties:
 *               moderatorId:
 *                 type: string
 *                 format: uuid
 *                 example: "b2c3d4e5-f6a7-8901-bcde-f01234567890"
 *     responses:
 *       201:
 *         description: Modérateur assigné avec succès
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
 *                   example: "Modérateur assigné avec succès"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     name:
 *                       type: string
 *                       example: "Moussa Ndiaye"
 *                     email:
 *                       type: string
 *                       example: "moussa@eventflow.com"
 *                     avatarUrl:
 *                       type: string
 *                       nullable: true
 *                     assignedAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: L'utilisateur n'est pas un modérateur
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Non propriétaire de l'événement
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Événement ou modérateur introuvable
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Modérateur déjà assigné à cet événement
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  "/:id/moderators",
  requireRole("ORGANIZER"),
  validate(addModeratorSchema),
  eventController.addModerator
);

/**
 * @swagger
 * /api/events/{eventId}/moderators/{moderatorId}:
 *   delete:
 *     summary: Retirer un modérateur d'un événement
 *     description: Réservé à l'organisateur propriétaire de l'événement.
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Identifiant de l'événement
 *       - in: path
 *         name: moderatorId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Identifiant du modérateur à retirer
 *     responses:
 *       200:
 *         description: Modérateur retiré avec succès
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
 *                   example: "Modérateur retiré avec succès"
 *       403:
 *         description: Non propriétaire de l'événement
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Événement introuvable ou modérateur non assigné
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete(
  "/:eventId/moderators/:moderatorId",
  requireRole("ORGANIZER"),
  validate(removeModeratorSchema),
  eventController.removeModerator
);

export default router;