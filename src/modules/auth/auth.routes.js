import { Router } from "express";
import { AuthController } from "./auth.controller.js";
import {
  validate,
  validateBody,
} from "../../shared/middlewares/validate.middleware.js";
import { authenticate } from "../../shared/middlewares/auth.middleware.js";
import { uploadSingle } from "../../shared/middlewares/upload.middleware.js";
import { sanitizeBody } from "../../shared/middlewares/sanitize.middleware.js";
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  updateProfileSchema,
} from "./auth.validator.js";
import {
  authLimiter,
  registerLimiter,
  refreshTokenLimiter,
} from "../../config/rateLimiter.js";

const router = Router();
const authController = new AuthController();

// ─── Routes publiques ─────────────────────────────────────────

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Créer un compte staff (organisateur ou modérateur)
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [nom, prenom, email, password, role]
 *             properties:
 *               nom:
 *                 type: string
 *                 example: "Diallo"
 *               prenom:
 *                 type: string
 *                 example: "Amadou"
 *               email:
 *                 type: string
 *                 example: "amadou@eventflow.com"
 *               password:
 *                 type: string
 *                 example: "MonMotDePasse1"
 *               role:
 *                 type: string
 *                 enum: [ORGANIZER, MODERATOR]
 *               avatar:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Compte créé avec succès
 *       409:
 *         description: Email déjà utilisé
 */
router.post(
  "/register",
  registerLimiter,
  uploadSingle("avatar"),
  sanitizeBody,
  validate(registerSchema),
  authController.register,
);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Connexion avec email et mot de passe
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 example: "amadou@eventflow.com"
 *               password:
 *                 type: string
 *                 example: "MonMotDePasse1"
 *               deviceId:
 *                 type: string
 *                 example: "expo-device-abc123"
 *     responses:
 *       200:
 *         description: Connexion réussie
 *       401:
 *         description: Identifiants incorrects
 */
router.post("/login", authLimiter, validate(loginSchema), authController.login);

/**
 * @swagger
 * /api/auth/refresh-token:
 *   post:
 *     summary: Rafraîchir l'access token
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token rafraîchi
 *       401:
 *         description: Token invalide ou révoqué
 */
router.post(
  "/refresh-token",
  refreshTokenLimiter,
  validate(refreshTokenSchema),
  authController.refreshToken,
);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Déconnexion — révoque le refresh token
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Déconnexion réussie
 */
router.post(
  "/logout",
  validate(refreshTokenSchema),
  authController.logout,
);

// ─── Routes protégées ─────────────────────────────────────────

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Profil de l'utilisateur connecté
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profil récupéré
 *       401:
 *         description: Non authentifié
 */
router.get("/me", authenticate, authController.getCurrentUser);

/**
 * @swagger
 * /api/auth/profile:
 *   patch:
 *     summary: Mettre à jour le profil
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               nom:
 *                 type: string
 *               prenom:
 *                 type: string
 *               avatar:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Profil mis à jour
 *       401:
 *         description: Non authentifié
 */
router.patch(
  "/profile",
  authenticate,
  uploadSingle("avatar"),
  sanitizeBody,
  validate(updateProfileSchema),
  authController.updateProfile,
);

/**
 * @swagger
 * /api/auth/revoke-all-tokens:
 *   post:
 *     summary: Déconnecter tous les appareils
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Tous les appareils déconnectés
 *       401:
 *         description: Non authentifié
 */
router.post("/revoke-all-tokens", authenticate, authController.revokeAllTokens);

export default router;
