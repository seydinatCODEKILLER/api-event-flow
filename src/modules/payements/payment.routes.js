import { Router } from "express";
import { PaymentController } from "./payment.controller.js";
import { validate } from "../../shared/middlewares/validate.middleware.js";
import { authenticate } from "../../shared/middlewares/auth.middleware.js";
import { crudLimiter } from "../../config/rateLimiter.js";
import {
  initiateSchema,
  confirmSchema,
  paymentIdSchema,
} from "./payment.validator.js";

const router = Router();
const paymentController = new PaymentController();

router.use(authenticate);
router.use(crudLimiter);

/**
 * @swagger
 * /api/payments/initiate:
 *   post:
 *     summary: Initier un paiement
 *     description: |
 *       Crée ou met à jour une intention de paiement PENDING.
 *       Si un PENDING existe déjà pour cet événement, il est mis à jour avec la nouvelle méthode.
 *     tags: [Payments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [eventId, method]
 *             properties:
 *               eventId:
 *                 type: string
 *                 format: uuid
 *               method:
 *                 type: string
 *                 enum: [ORANGE_MONEY, WAVE, FREE_MONEY, CARD]
 *     responses:
 *       200:
 *         description: Détails du paiement à traiter
 *       400:
 *         description: Événement gratuit ou fermé
 */
router.post("/initiate", validate(initiateSchema), paymentController.initiate);

/**
 * @swagger
 * /api/payments/confirm:
 *   post:
 *     summary: Confirmer un paiement (Webhook)
 *     description: |
 *       Endpoint appelé par le frontend après la redirection de l'opérateur,
 *       ou par un Webhook serveur de l'opérateur.
 *       Si le statut est COMPLETED, le ticket est généré automatiquement.
 *       Ce endpoint est IDEMPOTENT.
 *     tags: [Payments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reference, status]
 *             properties:
 *               reference:
 *                 type: string
 *                 example: "TXN-1690000000000-a1b2c3"
 *               status:
 *                 type: string
 *                 enum: [COMPLETED, FAILED]
 *               failureReason:
 *                 type: string
 *                 example: "Fonds insuffisants"
 *     responses:
 *       200:
 *         description: Paiement traité avec succès
 */
router.post("/confirm", validate(confirmSchema), paymentController.confirm);

/**
 * @swagger
 * /api/payments/{id}:
 *   get:
 *     summary: Détails d'un paiement
 *     tags: [Payments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: "string", format: "uuid" }
 *     responses:
 *       200:
 *         description: Détails du paiement incluant l'événement et le ticket (si généré)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: "boolean", example: true }
 *                 data:
 *                   $ref: '#/components/schemas/Payment'
 */
router.get("/:id", validate(paymentIdSchema), paymentController.getDetails);

export default router;
