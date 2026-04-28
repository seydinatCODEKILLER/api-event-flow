import { Router } from "express";
import { AuthController } from "./auth.controller.js";
import {
  validate,
  validateBody,
} from "../../shared/middlewares/validate.middleware.js";
import {
  authenticate,
  authenticateParticipant,
} from "../../shared/middlewares/auth.middleware.js";
import { uploadSingle } from "../../shared/middlewares/upload.middleware.js";
import { sanitizeBody } from "../../shared/middlewares/sanitize.middleware.js";
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  updateProfileSchema,
  registerParticipantSchema,
  loginParticipantSchema,
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

// ─── Routes participant (publiques) ───────────────────────────

/**
 * @swagger
 * /api/auth/participant/register:
 *   post:
 *     summary: Inscription d'un participant
 *     description: Crée un compte participant directement actif (auto-inscrit).
 *     tags: [Auth - Participant]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fullName, email, password]
 *             properties:
 *               fullName:
 *                 type: string
 *                 example: "Fatou Sow"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "fatou@gmail.com"
 *               password:
 *                 type: string
 *                 format: password
 *                 description: Min 8 caractères, 1 majuscule, 1 minuscule, 1 chiffre
 *                 example: "MonMotDePasse1"
 *               phone:
 *                 type: string
 *                 example: "+221771234567"
 *     responses:
 *       201:
 *         description: Compte créé avec succès
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
 *                     participant:
 *                       $ref: '#/components/schemas/Participant'
 *                     accessToken:
 *                       type: string
 *                     refreshToken:
 *                       type: string
 *       409:
 *         description: Email déjà utilisé
 */
router.post(
  "/participant/register",
  registerLimiter,
  validate(registerParticipantSchema),
  authController.registerParticipant,
);

/**
 * @swagger
 * /api/auth/participant/login:
 *   post:
 *     summary: Connexion participant
 *     description: Connecte un participant. Échoue si le compte est en attente d'activation (PENDING) ou si le mot de passe est invalide.
 *     tags: [Auth - Participant]
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
 *                 format: email
 *                 example: "fatou@gmail.com"
 *               password:
 *                 type: string
 *                 example: "MonMotDePasse1"
 *     responses:
 *       200:
 *         description: Connexion réussie
 *       401:
 *         description: Identifiants incorrects ou compte non activé
 */
router.post(
  "/participant/login",
  authLimiter,
  validate(loginParticipantSchema),
  authController.loginParticipant,
);

/**
 * @swagger
 * /api/auth/participant/activate:
 *   post:
 *     summary: Activer un compte participant (via import CSV)
 *     description: Permet à un participant "fantôme" (ajouté par l'organisateur) de définir son mot de passe et d'activer son compte grâce au token reçu par email.
 *     tags: [Auth - Participant]
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
 *                 description: Token d'activation unique reçu par email
 *                 example: "a1b2c3d4e5f6g7h8i9j0..."
 *               password:
 *                 type: string
 *                 description: Min 8 caractères, 1 majuscule, 1 minuscule, 1 chiffre
 *                 example: "MonMotDePasse1"
 *     responses:
 *       200:
 *         description: Compte activé avec succès, retourne les tokens de session
 *       401:
 *         description: Token d'activation expiré
 *       404:
 *         description: Token d'activation invalide
 *       409:
 *         description: Ce compte est déjà activé
 */
router.post(
  "/participant/activate",
  validate(activateAccountSchema),
  authController.activateAccount,
);

/**
 * @swagger
 * /api/auth/participant/refresh-token:
 *   post:
 *     summary: Rafraîchir le token participant
 *     description: Génère une nouvelle paire de tokens à partir d'un refresh token valide. Révoque tous les appareils si le token a été réutilisé après révocation (sécurité).
 *     tags: [Auth - Participant]
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
 *         description: Token rafraîchi avec succès
 *       401:
 *         description: Token invalide, révoqué ou expiré
 */
router.post(
  "/participant/refresh-token",
  refreshTokenLimiter,
  validate(refreshTokenSchema),
  authController.refreshParticipantToken,
);

/**
 * @swagger
 * /api/auth/participant/logout:
 *   post:
 *     summary: Déconnexion participant
 *     description: Révoque le refresh token fourni.
 *     tags: [Auth - Participant]
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
  "/participant/logout",
  validate(refreshTokenSchema),
  authController.logoutParticipant,
);

// ─── Routes participant (protégées) ───────────────────────────

/**
 * @swagger
 * /api/auth/participant/me:
 *   get:
 *     summary: Profil du participant connecté
 *     description: Retourne les informations du participant authentifié, ainsi que la liste de ses tickets avec les détails des événements associés.
 *     tags: [Auth - Participant]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profil et billets récupérés avec succès
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
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     fullName:
 *                       type: string
 *                     email:
 *                       type: string
 *                     phone:
 *                       type: string
 *                     status:
 *                       type: string
 *                       enum: [PENDING, ACTIVE]
 *                     tickets:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           status:
 *                             type: string
 *                             enum: [ACTIVE, USED, CANCELLED]
 *                           qrUrl:
 *                             type: string
 *                             format: uri
 *                           event:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                               title:
 *                                 type: string
 *                               startDate:
 *                                 type: string
 *                                 format: date-time
 *                               location:
 *                                 type: string
 *       401:
 *         description: Non authentifié ou compte non activé (PENDING)
 */
router.get(
  "/participant/me",
  authenticateParticipant,
  authController.getCurrentParticipant,
);

export default router;
