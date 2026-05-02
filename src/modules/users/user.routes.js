import { Router } from "express";
import { UserController } from "./user.controller.js";
import { validate } from "../../shared/middlewares/validate.middleware.js";
import { authenticate } from "../../shared/middlewares/auth.middleware.js";
import { uploadSingle } from "../../shared/middlewares/upload.middleware.js";
import { crudLimiter } from "../../config/rateLimiter.js";
import {
  updateProfileSchema,
  updatePushTokenSchema,
  getHistorySchema,
} from "./user.validator.js";

const router = Router();
const userController = new UserController();

router.use(authenticate);
router.use(crudLimiter);

/**
 * @swagger
 * /api/users/me:
 *   get:
 *     summary: Obtenir mon profil
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: Profil de l'utilisateur connecté
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: "boolean", example: true }
 *                 data:
 *                   $ref: '#/components/schemas/User'
 */
router.get("/me", userController.getMe);

/**
 * @swagger
 * /api/users/me:
 *   patch:
 *     summary: Modifier mon profil
 *     description: Permet de modifier le nom, l'email, le téléphone et l'avatar.
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               fullName: { type: "string", example: "Nouveau Nom" }
 *               email: { type: "string", format: "email", example: "new@email.com" }
 *               phone: { type: "string", example: "+221771234567" }
 *               avatar:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Profil mis à jour
 */
router.patch(
  "/me",
  uploadSingle("avatar"),
  validate(updateProfileSchema),
  userController.updateProfile,
);

/**
 * @swagger
 * /api/users/me:
 *   delete:
 *     summary: Supprimer mon compte
 *     description: Supprime définitivement le compte et toutes les données associées.
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: Compte supprimé
 */
router.delete("/me", userController.deleteAccount);

/**
 * @swagger
 * /api/users/me/push-token:
 *   patch:
 *     summary: Mettre à jour le Push Token (Expo)
 *     description: Appelé au démarrage de l'app mobile pour recevoir les notifications.
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [pushToken]
 *             properties:
 *               pushToken:
 *                 type: string
 *                 example: "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"
 *     responses:
 *       200:
 *         description: Token mis à jour
 */
router.patch(
  "/me/push-token",
  validate(updatePushTokenSchema),
  userController.updatePushToken,
);

/**
 * @swagger
 * /api/users/me/tickets:
 *   get:
 *     summary: Historique de mes tickets
 *     tags: [Users]
 *     parameters:
 *       - $ref: '#/components/parameters/pageQuery'
 *       - in: query
 *         name: limit
 *         schema: { type: "integer", default: 10 }
 *     responses:
 *       200:
 *         description: Liste des tickets de l'utilisateur
 */
router.get(
  "/me/tickets",
  validate(getHistorySchema),
  userController.getMyTickets,
);

/**
 * @swagger
 * /api/users/me/events:
 *   get:
 *     summary: Événements auxquels je participe
 *     description: Liste les événements (non brouillons) où l'utilisateur possède un ticket.
 *     tags: [Users]
 *     parameters:
 *       - $ref: '#/components/parameters/pageQuery'
 *       - in: query
 *         name: limit
 *         schema: { type: "integer", default: 10 }
 *     responses:
 *       200:
 *         description: Liste des événements
 */
router.get(
  "/me/events",
  validate(getHistorySchema),
  userController.getMyEvents,
);

/**
 * @swagger
 * /api/users/me/payments:
 *   get:
 *     summary: Historique de mes paiements
 *     tags: [Users]
 *     parameters:
 *       - $ref: '#/components/parameters/pageQuery'
 *       - in: query
 *         name: limit
 *         schema: { type: "integer", default: 10 }
 *     responses:
 *       200:
 *         description: Liste des paiements
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: "boolean", example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Payment'
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationMeta'
 */
router.get(
  "/me/payments",
  validate(getHistorySchema),
  userController.getMyPayments,
);

export default router;
