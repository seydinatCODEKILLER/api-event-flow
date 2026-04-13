import { Router } from "express";
import { SyncController } from "./sync.controller.js";
import { validate } from "../../shared/middlewares/validate.middleware.js";
import { authenticate, requireRole } from "../../shared/middlewares/auth.middleware.js";
import { syncLimiter, crudLimiter } from "../../config/rateLimiter.js";
import {
  syncScansSchema,
  eventIdParamSchema,
} from "./sync.validator.js";

const router = Router({ mergeParams: true });
const syncController = new SyncController();

router.use(authenticate);

/**
 * @swagger
 * /api/events/{eventId}/sync:
 *   post:
 *     summary: Synchroniser les scans offline (mobile → serveur)
 *     description: |
 *       Endpoint principal de l'offline-first.
 *       Le mobile envoie tous ses ScanLogs en batch après reconnexion.
 *       Le serveur traite chaque scan par ordre de scannedAt croissant
 *       et applique la règle "first scan wins" pour résoudre les conflits.
 *
 *       Résultats possibles par scan :
 *       - VALID — ticket validé avec succès
 *       - ALREADY_USED — ticket déjà utilisé par un autre scan
 *       - CONFLICT — scan antérieur à un scan déjà enregistré
 *       - INVALID — ticket introuvable, annulé ou données incorrectes
 *       - SKIPPED — scan déjà synchronisé (doublon)
 *     tags: [Sync]
 *     security:
 *       - bearerAuth: []
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
 *             required: [deviceId, scans]
 *             properties:
 *               deviceId:
 *                 type: string
 *                 example: "expo-device-abc123"
 *               scans:
 *                 type: array
 *                 maxItems: 500
 *                 items:
 *                   type: object
 *                   required: [ticketId, scannedAt]
 *                   properties:
 *                     ticketId:
 *                       type: string
 *                       format: uuid
 *                     scannedAt:
 *                       type: string
 *                       format: date-time
 *                       description: Horodatage LOCAL du scan
 *                       example: "2025-12-01T20:35:00.000Z"
 *           examples:
 *             batch_normal:
 *               summary: Batch de 3 scans
 *               value:
 *                 deviceId: "expo-device-abc123"
 *                 scans:
 *                   - ticketId: "a1b2c3d4-..."
 *                     scannedAt: "2025-12-01T20:30:00.000Z"
 *                   - ticketId: "e5f6g7h8-..."
 *                     scannedAt: "2025-12-01T20:31:00.000Z"
 *                   - ticketId: "i9j0k1l2-..."
 *                     scannedAt: "2025-12-01T20:32:00.000Z"
 *     responses:
 *       200:
 *         description: Synchronisation terminée
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
 *                   example: "Synchronisation terminée — 3 validé(s), 0 conflit(s)"
 *                 data:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                       example: 3
 *                     valid:
 *                       type: integer
 *                       example: 2
 *                     already_used:
 *                       type: integer
 *                       example: 0
 *                     conflict:
 *                       type: integer
 *                       example: 1
 *                     invalid:
 *                       type: integer
 *                       example: 0
 *                     skipped:
 *                       type: integer
 *                       example: 0
 *                     details:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           ticketId:
 *                             type: string
 *                             format: uuid
 *                           scannedAt:
 *                             type: string
 *                             format: date-time
 *                           result:
 *                             type: string
 *                             enum: [VALID, ALREADY_USED, CONFLICT, INVALID, SKIPPED]
 *                           message:
 *                             type: string
 *       400:
 *         description: Aucun scan ou données invalides
 *       403:
 *         description: Modérateur non assigné à l'événement
 */
router.post(
  "/",
  requireRole("MODERATOR"),
  syncLimiter,
  validate(syncScansSchema),
  syncController.syncScans
);

/**
 * @swagger
 * /api/events/{eventId}/sync/report:
 *   get:
 *     summary: Rapport de synchronisation post-événement (modérateur)
 *     description: |
 *       Retourne le résumé des scans effectués par tous les modérateurs
 *       sur l'événement. Accessible par le modérateur assigné.
 *     tags: [Sync]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Rapport de synchronisation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     eventId:
 *                       type: string
 *                       format: uuid
 *                     total:
 *                       type: integer
 *                     VALID:
 *                       type: integer
 *                     ALREADY_USED:
 *                       type: integer
 *                     INVALID:
 *                       type: integer
 *                     CONFLICT:
 *                       type: integer
 *                     attendanceRate:
 *                       type: number
 *                       example: 87
 *       403:
 *         description: Non assigné à l'événement
 */
router.get(
  "/report",
  requireRole("MODERATOR"),
  crudLimiter,
  validate(eventIdParamSchema),
  syncController.getSyncReport
);

/**
 * @swagger
 * /api/events/{eventId}/stats:
 *   get:
 *     summary: Statistiques complètes de l'événement (dashboard organisateur)
 *     description: |
 *       Retourne les stats en temps réel : tickets, entrées validées,
 *       taux de présence, conflits détectés.
 *       Réservé à l'organisateur propriétaire.
 *     tags: [Sync]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Statistiques de l'événement
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EventStats'
 *       403:
 *         description: Non organisateur de l'événement
 *       404:
 *         description: Événement introuvable
 */
router.get(
  "/",
  requireRole("ORGANIZER"),
  crudLimiter,
  validate(eventIdParamSchema),
  syncController.getEventStats
);

export default router;