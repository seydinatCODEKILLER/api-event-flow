import { Router } from "express";
import { FeedController } from "./feed.controller.js";
import { validate } from "../../shared/middlewares/validate.middleware.js";
import { authenticate } from "../../shared/middlewares/auth.middleware.js";
import { crudLimiter } from "../../config/rateLimiter.js";
import {
  getFeedSchema,
  getNearbySchema,
  eventIdSchema,
  registerSchema,
} from "./feed.validator.js";

const router = Router();
const feedController = new FeedController();

router.use(authenticate);
router.use(crudLimiter);

/**
 * @swagger
 * /api/feed:
 *   get:
 *     summary: Feed principal des événements
 *     description: Liste les événements publiés/en cours avec filtres.
 *     tags: [Feed]
 *     parameters:
 *       - $ref: '#/components/parameters/pageQuery'
 *       - in: query
 *         name: limit
 *         schema: { type: "integer", default: 20 }
 *       - in: query
 *         name: category
 *         schema: { type: "string", enum: [CONCERT, CONFERENCE, SPORT, FETE, ART, GASTRONOMIE, AUTRE] }
 *       - in: query
 *         name: city
 *         schema: { type: "string" }
 *       - in: query
 *         name: isFree
 *         schema: { type: "boolean" }
 *       - in: query
 *         name: search
 *         schema: { type: "string" }
 *     responses:
 *       200:
 *         description: Liste des événements
 */
router.get("/", validate(getFeedSchema), feedController.getFeed);

/**
 * @swagger
 * /api/feed/nearby:
 *   get:
 *     summary: Événements à proximité
 *     description: Retourne les événements triés par distance (nécessite latitude et longitude).
 *     tags: [Feed]
 *     parameters:
 *       - in: query
 *         name: latitude
 *         required: true
 *         schema: { type: "number", example: 14.6937 }
 *       - in: query
 *         name: longitude
 *         required: true
 *         schema: { type: "number", example: -17.4441 }
 *       - in: query
 *         name: radius
 *         description: Rayon de recherche en kilomètres
 *         schema: { type: "integer", default: 50 }
 *       - in: query
 *         name: limit
 *         schema: { type: "integer", default: 20 }
 *     responses:
 *       200:
 *         description: Liste des événements proches
 */
router.get("/nearby", validate(getNearbySchema), feedController.getNearby);

/**
 * @swagger
 * /api/feed/events/{id}:
 *   get:
 *     summary: Détail d'un événement public
 *     description: Retourne les détails de l'événement et indique si l'utilisateur est inscrit.
 *     tags: [Feed]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: "string", format: "uuid" }
 *     responses:
 *       200:
 *         description: Détail de l'événement
 */
router.get(
  "/events/:id",
  validate(eventIdSchema),
  feedController.getEventDetail,
);

/**
 * @swagger
 * /api/feed/events/{id}/register:
 *   post:
 *     summary: S'inscrire à un événement
 *     description: |
 *       Si l'événement est gratuit, crée le ticket immédiatement.
 *       Si l'événement est payant, crée une intention de paiement en attente.
 *     tags: [Feed]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: "string", format: "uuid" }
 *     responses:
 *       200:
 *         description: Inscription réussie (Événement gratuit)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: "boolean", example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     requiresPayment: { type: "boolean", example: false }
 *                     message: { type: "string", example: "Inscription réussie !" }
 *                     ticketId: { type: "string", format: "uuid" }
 *                     paymentId: { type: "string", format: "uuid", nullable: true }
 *       201:
 *         description: Paiement requis (Événement payant)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: "boolean", example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     requiresPayment: { type: "boolean", example: true }
 *                     message: { type: "string", example: "Paiement requis..." }
 *                     ticketId: { type: "string", format: "uuid", nullable: true }
 *                     paymentId: { type: "string", format: "uuid" }
 *                     amount: { type: "number", example: 5000 }
 *       400:
 *         description: Événement complet ou fermé
 *       409:
 *         description: Déjà inscrit
 */
router.post(
  "/events/:id/register",
  validate(registerSchema),
  feedController.register,
);

export default router;
