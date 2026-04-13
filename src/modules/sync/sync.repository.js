import { prisma } from "../../config/database.js";
import { BaseRepository } from "../../shared/base/base.repository.js";

export class SyncRepository extends BaseRepository {
  constructor() {
    super(prisma.scanLog);
  }

  // Vérifie si un ticket existe et est lié à l'événement
  findTicketForSync(ticketId, eventId) {
    return prisma.ticket.findFirst({
      where: { id: ticketId, eventId },
      select: {
        id: true,
        status: true,
        participantId: true,
        participant: {
          select: { fullName: true },
        },
      },
    });
  }

  // Cherche le premier scan valide d'un ticket (résolution conflit)
  findFirstValidScan(ticketId) {
    return prisma.scanLog.findFirst({
      where: { ticketId, result: "VALID" },
      orderBy: { scannedAt: "asc" },
    });
  }

  // Cherche un scan existant pour le même ticket + device (évite doublons)
  findExistingScan(ticketId, deviceId, scannedAt) {
    return prisma.scanLog.findFirst({
      where: {
        ticketId,
        deviceId,
        scannedAt: new Date(scannedAt),
      },
    });
  }

  createScanLog(data) {
    return prisma.scanLog.create({ data });
  }

  // Marque un ticket comme USED
  markTicketUsed(ticketId, scannedAt) {
    return prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status: "USED",
        usedAt: new Date(scannedAt),
      },
    });
  }

  // Récupère les scans non synchronisés d'un device
  findUnsyncedByDevice(deviceId) {
    return prisma.scanLog.findMany({
      where: { deviceId, syncedAt: null },
      orderBy: { scannedAt: "asc" },
    });
  }

  // Stats de sync pour un événement
  findSyncStatsByEvent(eventId) {
    return prisma.scanLog.groupBy({
      by: ["result"],
      where: { eventId },
      _count: { result: true },
    });
  }

  // Tous les scans d'un événement pour le dashboard
  findScansByEvent(eventId, options = {}) {
    const { page, limit } = options;
    return prisma.scanLog.findMany({
      where: { eventId },
      include: {
        moderator: {
          select: { id: true, nom: true, prenom: true },
        },
        ticket: {
          select: {
            id: true,
            participant: {
              select: { fullName: true },
            },
          },
        },
      },
      orderBy: { scannedAt: "desc" },
      skip: page && limit ? (page - 1) * limit : undefined,
      take: limit || undefined,
    });
  }
}
