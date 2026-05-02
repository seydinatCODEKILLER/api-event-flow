import { Router } from "express";
import { NotificationController } from "./notification.controller.js";
import { validate } from "../../shared/middlewares/validate.middleware.js";
import { authenticate } from "../../shared/middlewares/auth.middleware.js";
import { crudLimiter } from "../../config/rateLimiter.js";
import {
  getNotificationsSchema,
  notificationIdSchema,
} from "./notification.validator.js";

const router = Router();
const notificationController = new NotificationController();

router.use(authenticate);
router.use(crudLimiter);

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     summary: Lister mes notifications
 *     description: Retourne les notifications de l'utilisateur connecté, triées par date de création décroissante.
 *     tags: [Notifications]
 *     parameters:
 *       - $ref: '#/components/parameters/pageQuery'
 *       - $ref: '#/components/parameters/limitQuery'
 *     responses:
 *       200:
 *         description: Liste des notifications
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: "boolean", example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Notification'
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationMeta'
 */
router.get(
  "/",
  validate(getNotificationsSchema),
  notificationController.getNotifications,
);

/**
 * @swagger
 * /api/notifications/read-all:
 *   patch:
 *     summary: Marquer toutes les notifications comme lues
 *     tags: [Notifications]
 *     responses:
 *       200:
 *         description: Succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: "boolean", example: true }
 *                 message: { type: "string", example: "Toutes les notifications ont été marquées comme lues" }
 */
router.patch("/read-all", notificationController.markAllAsRead);

/**
 * @swagger
 * /api/notifications/{id}/read:
 *   patch:
 *     summary: Marquer une notification comme lue
 *     tags: [Notifications]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: "string", format: "uuid" }
 *     responses:
 *       200:
 *         description: Succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: "boolean", example: true }
 *                 message: { type: "string", example: "Notification marquée comme lue" }
 *       404:
 *         description: Notification introuvable (ou n'appartient pas à l'utilisateur)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.patch(
  "/:id/read",
  validate(notificationIdSchema),
  notificationController.markAsRead,
);

/**
 * @swagger
 * /api/notifications/{id}:
 *   delete:
 *     summary: Supprimer une notification
 *     tags: [Notifications]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: "string", format: "uuid" }
 *     responses:
 *       200:
 *         description: Succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: "boolean", example: true }
 *                 message: { type: "string", example: "Notification supprimée avec succès" }
 *       404:
 *         description: Notification introuvable (ou n'appartient pas à l'utilisateur)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete(
  "/:id",
  validate(notificationIdSchema),
  notificationController.deleteNotification,
);

export default router;
