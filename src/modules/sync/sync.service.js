import { SyncRepository } from "./sync.repository.js";
import { EventRepository } from "../events/event.repository.js";
import {
  ForbiddenError,
  BadRequestError,
  NotFoundError,
} from "../../shared/errors/AppError.js";
import logger from "../../config/logger.js";

const syncRepo = new SyncRepository();
const eventRepo = new EventRepository();

// ─── Service ──────────────────────────────────────────────────

export class SyncService {
  /**
   * Synchronise un batch de scans offline envoyés par le mobile.
   *
   * Règle de résolution des conflits :
   * "First scan wins" — le scan avec le scannedAt le plus ancien gagne.
   * Si un ticket a déjà été marqué USED (par un autre device ou en online),
   * le scan est marqué CONFLICT.
   *
   * @param {string} eventId
   * @param {string} moderatorId
   * @param {string} deviceId
   * @param {Array}  scans - [{ ticketId, scannedAt }]
   */
  async syncScans(eventId, moderatorId, deviceId, scans) {
    // Vérifier que le modérateur est assigné à l'événement
    const assigned = await eventRepo.findModerator(eventId, moderatorId);
    if (!assigned) {
      throw new ForbiddenError("Vous n'êtes pas assigné à cet événement");
    }

    if (!scans || scans.length === 0) {
      throw new BadRequestError("Aucun scan à synchroniser");
    }

    const results = {
      total: scans.length,
      valid: 0,
      already_used: 0,
      conflict: 0,
      invalid: 0,
      skipped: 0, // doublons déjà synchronisés
      details: [],
    };

    // Traitement séquentiel pour éviter les race conditions
    for (const scan of scans) {
      const { ticketId, scannedAt } = scan;

      try {
        const result = await this.#processScan({
          ticketId,
          eventId,
          moderatorId,
          deviceId,
          scannedAt,
        });

        results[result.result.toLowerCase()]++;
        results.details.push({
          ticketId,
          scannedAt,
          result: result.result,
          message: result.message,
        });
      } catch (err) {
        logger.error(
          { err, ticketId, deviceId },
          "Erreur traitement scan offline",
        );
        results.invalid++;
        results.details.push({
          ticketId,
          scannedAt,
          result: "INVALID",
          message: err.message,
        });
      }
    }

    logger.logEvent("sync_completed", {
      eventId,
      moderatorId,
      deviceId,
      total: results.total,
      valid: results.valid,
      conflicts: results.conflict,
    });

    return results;
  }

  // ─── Traitement d'un scan individuel (privé) ──────────────────
  async #processScan({ ticketId, eventId, moderatorId, deviceId, scannedAt }) {
    // 1. Vérifier que le ticket appartient à l'événement
    const ticket = await syncRepo.findTicketForSync(ticketId, eventId);
    if (!ticket) {
      return {
        result: "INVALID",
        message: "Ticket introuvable ou ne correspond pas à l'événement",
      };
    }

    // 2. Vérifier doublon — scan déjà synchronisé (même ticket + device + timestamp)
    const duplicate = await syncRepo.findExistingScan(
      ticketId,
      deviceId,
      scannedAt,
    );
    if (duplicate) {
      return { result: "SKIPPED", message: "Scan déjà synchronisé" };
    }

    // 3. Ticket annulé
    if (ticket.status === "CANCELLED") {
      await syncRepo.createScanLog({
        ticketId,
        eventId,
        moderatorId,
        deviceId,
        result: "INVALID",
        scannedAt: new Date(scannedAt),
        syncedAt: new Date(),
      });
      return { result: "INVALID", message: "Ticket annulé" };
    }

    // 4. Ticket déjà USED — vérifier si c'est un conflit offline
    if (ticket.status === "USED") {
      // Chercher le premier scan valide pour déterminer qui a gagné
      const firstValidScan = await syncRepo.findFirstValidScan(ticketId);

      // Si le scan actuel est antérieur au premier scan valide connu
      // → ce scan aurait dû gagner mais a été battu par la sync
      const isEarlier =
        firstValidScan &&
        new Date(scannedAt) < new Date(firstValidScan.scannedAt);

      const scanResult = isEarlier ? "CONFLICT" : "ALREADY_USED";

      await syncRepo.createScanLog({
        ticketId,
        eventId,
        moderatorId,
        deviceId,
        result: scanResult,
        scannedAt: new Date(scannedAt),
        syncedAt: new Date(),
      });

      return {
        result: scanResult,
        message:
          scanResult === "CONFLICT"
            ? "Conflit détecté — ce scan était antérieur mais le ticket a déjà été validé"
            : "Ticket déjà utilisé",
      };
    }

    // 5. Ticket ACTIVE → valider
    // Transaction : créer ScanLog + marquer USED en même temps
    await syncRepo.prisma.$transaction([
      syncRepo.prisma.scanLog.create({
        data: {
          ticketId,
          eventId,
          moderatorId,
          deviceId,
          result: "VALID",
          scannedAt: new Date(scannedAt),
          syncedAt: new Date(),
        },
      }),
      syncRepo.prisma.ticket.update({
        where: { id: ticketId },
        data: {
          status: "USED",
          usedAt: new Date(scannedAt), // horodatage local du scan
        },
      }),
    ]);

    return {
      result: "VALID",
      message: "Entrée validée",
      participant: ticket.participant,
    };
  }

  // ─── Rapport de sync pour un modérateur après l'événement ─────
  async getSyncReport(eventId, moderatorId) {
    const assigned = await eventRepo.findModerator(eventId, moderatorId);
    if (!assigned) {
      throw new ForbiddenError("Vous n'êtes pas assigné à cet événement");
    }

    const stats = await syncRepo.findSyncStatsByEvent(eventId);

    // Reformater le groupBy Prisma en objet lisible
    const formatted = {
      VALID: 0,
      ALREADY_USED: 0,
      INVALID: 0,
      CONFLICT: 0,
    };

    for (const stat of stats) {
      formatted[stat.result] = stat._count.result;
    }

    const total = Object.values(formatted).reduce((a, b) => a + b, 0);

    return {
      eventId,
      total,
      ...formatted,
      attendanceRate:
        total > 0 ? Math.round((formatted.VALID / total) * 100) : 0,
    };
  }

  // ─── Stats dashboard organisateur ─────────────────────────────
  async getEventStats(eventId, organizerId) {
    const event = await eventRepo.findById(eventId);
    if (!event) throw new NotFoundError("Événement");
    if (event.organizerId !== organizerId) {
      throw new ForbiddenError("Accès non autorisé");
    }

    const [scanStats, ticketStats] = await Promise.all([
      syncRepo.findSyncStatsByEvent(eventId),
      syncRepo.prisma.ticket.groupBy({
        by: ["status"],
        where: { eventId },
        _count: { status: true },
      }),
    ]);

    // Tickets
    const tickets = { ACTIVE: 0, USED: 0, CANCELLED: 0 };
    for (const s of ticketStats) {
      tickets[s.status] = s._count.status;
    }

    // Scans
    const scans = { VALID: 0, ALREADY_USED: 0, INVALID: 0, CONFLICT: 0 };
    for (const s of scanStats) {
      scans[s.result] = s._count.result;
    }

    const totalTickets = tickets.ACTIVE + tickets.USED + tickets.CANCELLED;
    const attendanceRate =
      totalTickets > 0 ? Math.round((tickets.USED / totalTickets) * 100) : 0;

    return {
      eventId,
      capacity: event.capacity,
      tickets: {
        total: totalTickets,
        ...tickets,
        remaining: event.capacity - totalTickets,
      },
      scans,
      attendanceRate,
      conflicts: scans.CONFLICT,
    };
  }
}
