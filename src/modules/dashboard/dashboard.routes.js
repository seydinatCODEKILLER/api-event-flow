import { Router } from "express";
import { DashboardController } from "./dashboard.controller.js";
import {
  authenticate,
  requireRole,
} from "../../shared/middlewares/auth.middleware.js";
import { crudLimiter } from "../../config/rateLimiter.js";

const router = Router();
const dashboardController = new DashboardController();

/**
 * @swagger
 * /api/dashboard/stats:
 *   get:
 *     summary: Statistiques globales du dashboard (Organisateur)
 *     description: |
 *       Retourne les KPIs, la distribution des tickets pour graphiques,
 *       l'activité récente et les prochains événements.
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistiques du dashboard
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
 *                     kpis:
 *                       type: object
 *                       properties:
 *                         totalEvents:
 *                           type: integer
 *                           example: 12
 *                         totalTickets:
 *                           type: integer
 *                           example: 1500
 *                         validatedEntries:
 *                           type: integer
 *                           example: 840
 *                         attendanceRate:
 *                           type: integer
 *                           example: 56
 *                     chartData:
 *                       type: object
 *                       properties:
 *                         ticketDistribution:
 *                           type: object
 *                           properties:
 *                             ACTIVE:
 *                               type: integer
 *                             USED:
 *                               type: integer
 *                             CANCELLED:
 *                               type: integer
 *                     recentActivity:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           participantName:
 *                             type: string
 *                           eventTitle:
 *                             type: string
 *                           moderatorName:
 *                             type: string
 *                           scannedAt:
 *                             type: string
 *                             format: date-time
 *                     upcomingEvents:
 *                       type: array
 *                       items:
 *                         type: object
 *       403:
 *         description: Réservé aux organisateurs
 */
router.get(
  "/stats",
  authenticate,
  requireRole("ORGANIZER"),
  crudLimiter,
  dashboardController.getStats,
);

export default router;
