import { Router } from "express";
import { ParticipantController } from "./participant.controller.js";
import { validate } from "../../shared/middlewares/validate.middleware.js";
import {
  authenticate,
  authenticateParticipant,
  requireRole,
} from "../../shared/middlewares/auth.middleware.js";
import { uploadSingle } from "../../shared/middlewares/upload.middleware.js";
import { crudLimiter } from "../../config/rateLimiter.js";
import {
  addParticipantSchema,
  importCsvSchema,
  getParticipantsSchema,
  participantIdSchema,
  updateParticipantSchema,
  updateMyProfileSchema,
} from "./participant.validator.js";
import { uploadCsv } from "../../shared/middlewares/upload-csv.middleware.js";

const router = Router({ mergeParams: true });
const participantController = new ParticipantController();

router.use(authenticate);
router.use(crudLimiter);

/**
 * @swagger
 * /api/events/{eventId}/participants:
 *   get:
 *     summary: Lister les participants d'un événement
 *     description: Accessible par l'organisateur et les modérateurs assignés.
 *     tags: [Participants]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Recherche par nom, email ou téléphone
 *     responses:
 *       200:
 *         description: Liste des participants avec pagination
 *       403:
 *         description: Accès non autorisé
 *       404:
 *         description: Événement introuvable
 */
router.get(
  "/",
  validate(getParticipantsSchema),
  participantController.getParticipants,
);

/**
 * @swagger
 * /api/events/{eventId}/participants:
 *   post:
 *     summary: Ajouter un participant manuellement
 *     tags: [Participants]
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
 *             required: [fullName]
 *             properties:
 *               fullName:
 *                 type: string
 *                 example: "Fatou Sow"
 *               email:
 *                 type: string
 *                 example: "fatou@gmail.com"
 *               phone:
 *                 type: string
 *                 example: "+221771234567"
 *     responses:
 *       201:
 *         description: Participant ajouté
 *       400:
 *         description: Capacité atteinte ou données invalides
 *       409:
 *         description: Participant déjà inscrit
 */
router.post(
  "/",
  requireRole("ORGANIZER"),
  validate(addParticipantSchema),
  participantController.addParticipant,
);

/**
 * @swagger
 * /api/events/{eventId}/participants/import:
 *   post:
 *     summary: Importer des participants depuis un fichier CSV
 *     description: |
 *       Le fichier CSV doit contenir les colonnes : fullName (requis), email (optionnel), phone (optionnel).
 *       Les participants déjà existants (même email ou téléphone) sont ignorés.
 *     tags: [Participants]
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
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Fichier CSV (max 5MB)
 *     responses:
 *       200:
 *         description: Import réussi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     imported:
 *                       type: integer
 *                       example: 48
 *                     skipped:
 *                       type: integer
 *                       example: 2
 *                     skippedNames:
 *                       type: array
 *                       items:
 *                         type: string
 *                     total:
 *                       type: integer
 *                       example: 50
 *       400:
 *         description: Fichier invalide ou capacité insuffisante
 */
router.post(
  "/import",
  requireRole("ORGANIZER"),
  uploadCsv,
  validate(importCsvSchema),
  participantController.importFromCsv,
);

/**
 * @swagger
 * /api/events/{eventId}/participants/{participantId}:
 *   get:
 *     summary: Détail d'un participant
 *     tags: [Participants]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: participantId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Détail du participant
 *       404:
 *         description: Participant introuvable
 */
router.get(
  "/:participantId",
  requireRole("ORGANIZER"),
  validate(participantIdSchema),
  participantController.getParticipantById,
);

/**
 * @swagger
 * /api/events/{eventId}/participants/{participantId}:
 *   patch:
 *     summary: Modifier un participant
 *     tags: [Participants]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: participantId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName:
 *                 type: string
 *               email:
 *                 type: string
 *                 nullable: true
 *               phone:
 *                 type: string
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Participant mis à jour
 *       404:
 *         description: Participant introuvable
 *       409:
 *         description: Email ou téléphone déjà utilisé
 */
router.patch(
  "/:participantId",
  requireRole("ORGANIZER"),
  validate(updateParticipantSchema),
  participantController.updateParticipant,
);

/**
 * @swagger
 * /api/events/{eventId}/participants/{participantId}:
 *   delete:
 *     summary: Supprimer un participant
 *     tags: [Participants]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: participantId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Participant supprimé
 *       404:
 *         description: Participant introuvable
 */
router.delete(
  "/:participantId",
  requireRole("ORGANIZER"),
  validate(participantIdSchema),
  participantController.deleteParticipant,
);

// ─── ROUTEUR ESPACE PARTICIPANT (Public Web) ──────────────────
// Ces routes ne sont pas liées à un événement spécifique dans l'URL,
// elles concernent le compte du participant connecté.

export const participantSpaceRouter = Router();

participantSpaceRouter.use(authenticateParticipant);

/**
 * @swagger
 * /api/participants/me/profile:
 *   get:
 *     summary: Récupérer mon profil participant
 *     description: Permet à un participant connecté (via l'application web) de récupérer ses informations personnelles et son statut d'activation.
 *     tags: [Participants - Espace Perso]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profil du participant récupéré avec succès
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
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     fullName:
 *                       type: string
 *                       example: "Fatou Sow"
 *                     email:
 *                       type: string
 *                       nullable: true
 *                       example: "fatou@gmail.com"
 *                     phone:
 *                       type: string
 *                       nullable: true
 *                       example: "+221771234567"
 *                     status:
 *                       type: string
 *                       enum: [PENDING, ACTIVE]
 *                       example: "ACTIVE"
 *                     hasAccount:
 *                       type: boolean
 *                       description: "True si le participant a défini son mot de passe (ACTIF)"
 *                       example: true
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: Non authentifié ou compte non activé (PENDING)
 */
participantSpaceRouter.get("/me/profile", participantController.getMyProfile);

/**
 * @swagger
 * /api/participants/me/tickets:
 *   get:
 *     summary: Lister mes billets
 *     description: Récupère la liste de tous les billets détenus par le participant connecté, avec les détails de l'événement associé et l'URL du QR Code.
 *     tags: [Participants - Espace Perso]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des billets récupérée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       status:
 *                         type: string
 *                         enum: [ACTIVE, USED, CANCELLED]
 *                         example: "ACTIVE"
 *                       qrUrl:
 *                         type: string
 *                         format: uri
 *                         description: "URL de l'image du QR Code à afficher sur le web"
 *                       usedAt:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                       event:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           title:
 *                             type: string
 *                             example: "Concert Afro Future"
 *                           location:
 *                             type: string
 *                             example: "Dakar Arena"
 *                           startDate:
 *                             type: string
 *                             format: date-time
 *                           status:
 *                             type: string
 *                             enum: [DRAFT, PUBLISHED, ONGOING, CLOSED]
 *       401:
 *         description: Non authentifié ou compte non activé
 */
participantSpaceRouter.get("/me/tickets", participantController.getMyTickets);

/**
 * @swagger
 * /api/participants/me/profile:
 *   patch:
 *     summary: Mettre à jour mon profil
 *     description: Permet au participant de modifier son nom complet ou son numéro de téléphone. (L'email ne peut pas être modifié ici pour des raisons de sécurité).
 *     tags: [Participants - Espace Perso]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName:
 *                 type: string
 *                 example: "Fatou Diallo Sow"
 *               phone:
 *                 type: string
 *                 nullable: true
 *                 example: "+221778889990"
 *     responses:
 *       200:
 *         description: Profil mis à jour avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                   example: "Profil mis à jour avec succès"
 *                 data:
 *                   $ref: '#/components/schemas/Participant'
 *       401:
 *         description: Non authentifié
 *       409:
 *         description: Le numéro de téléphone est déjà utilisé par un autre participant
 */
participantSpaceRouter.patch(
  "/me/profile",
  validate(updateMyProfileSchema),
  participantController.updateMyProfile,
);
export default router;
