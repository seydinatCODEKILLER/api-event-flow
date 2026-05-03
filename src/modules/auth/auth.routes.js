import { Router } from "express";
import { AuthController } from "./auth.controller.js";
import { validate } from "../../shared/middlewares/validate.middleware.js";
import { authenticate } from "../../shared/middlewares/auth.middleware.js";
import { uploadSingle } from "../../shared/middlewares/upload.middleware.js";
import { sanitizeBody } from "../../shared/middlewares/sanitize.middleware.js";
import {
  registerSchema,
  verifyEmailSchema,
  loginSchema,
  refreshTokenSchema,
  updateProfileSchema,
  activateAccountSchema,
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
 *     summary: Créer un compte
 *     description: Crée un compte en statut PENDING et envoie un email de vérification. Ne retourne pas de tokens.
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [fullName, email, password]
 *             properties:
 *               fullName:
 *                 type: string
 *                 example: "Amadou Diallo"
 *               email:
 *                 type: string
 *                 example: "amadou@gmail.com"
 *               password:
 *                 type: string
 *                 example: "MonMotDePasse1"
 *               phone:
 *                 type: string
 *                 example: "+221771234567"
 *               avatar:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Compte créé, en attente de vérification email
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
 * /api/auth/verify-email:
 *   post:
 *     summary: Vérifier l'adresse email
 *     description: Valide le token de vérification, active le compte et retourne les tokens de session (auto-login).
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token:
 *                 type: string
 *                 description: Token de vérification reçu par email
 *     responses:
 *       200:
 *         description: Email vérifié, tokens retournés
 *       401:
 *         description: Token expiré
 *       404:
 *         description: Token invalide
 *       409:
 *         description: Compte déjà vérifié
 */
router.post(
  "/verify-email",
  validate(verifyEmailSchema),
  authController.verifyEmail,
);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Connexion
 *     description: Connecte un utilisateur dont le compte est vérifié (ACTIVE).
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
 *                 example: "amadou@gmail.com"
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
 *         description: Identifiants incorrects ou email non vérifié
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
 *     summary: Déconnexion
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
router.post("/logout", validate(refreshTokenSchema), authController.logout);

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
 *               fullName:
 *                 type: string
 *               phone:
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

/**
 * @swagger
 * /api/auth/activate:
 *   post:
 *     summary: Activer un compte créé via lien public
 *     description: |
 *       Différent de /verify-email. Permet de valider l'email ET de définir
 *       le mot de passe pour les utilisateurs inscrits via un lien public (sans mot de passe).
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, password]
 *             properties:
 *               token:
 *                 type: string
 *               password:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Compte activé et connecté
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: "boolean", example: true }
 *                 message: { type: "string", example: "Compte activé avec succès !" }
 *                 data:
 *                   $ref: '#/components/schemas/AuthResponse'
 */
router.post(
  "/activate",
  validate(activateAccountSchema),
  authController.activatePublicAccount,
);

export default router;
